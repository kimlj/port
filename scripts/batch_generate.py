"""
WordWarz Avatar Batch Generator
Automated pipeline for generating character avatars via ComfyUI API
"""

import json
import time
import random
import urllib.request
import urllib.error
import sys
import os

# ─── CONFIG ──────────────────────────────────────────────────────────────
COMFYUI_URL = "http://127.0.0.1:8000"
OUTPUT_DIR = "./output"
MODEL = "NetaYumev35_pretrained_all_in_one.safetensors"
BATCH_SIZE = 1
MAX_VARIANTS = 24  # 8 categories × 3 variants each
WIDTH = 1024
HEIGHT = 1024
STEPS = 30
CFG = 4.0
SAMPLER = "res_multistep"
SCHEDULER = "simple"
SHIFT = 4.00
POLL_INTERVAL = 1.0

# ─── COLORS ──────────────────────────────────────────────────────────────
class C:
    ACCENT  = "\033[92m"   # green
    CYAN    = "\033[96m"
    YELLOW  = "\033[93m"
    DIM     = "\033[90m"
    BOLD    = "\033[1m"
    RED     = "\033[91m"
    MAGENTA = "\033[95m"
    WHITE   = "\033[97m"
    RESET   = "\033[0m"
    CLEAR_LINE = "\033[2K\r"

# ─── PROMPT LIBRARY ──────────────────────────────────────────────────────

BASE_PROMPT = (
    "1{gender}, chibi, halfy body portrait, head and shoulders, "
    "looking at viewer, masterpiece, best quality, ultra detailed, "
    "high resolution, vibrant anime color palette, rich saturated colors, "
    "deep colors, bold colors, high color separation, strong contrast, "
    "clean contrast, crisp lineart, smooth anti-aliased edges, "
    "cel-shading, dynamic lighting, soft rim lighting, controlled highlights, "
    "bright eyes with depth and sparkle, glossy skin, clear silhouette, "
    "modern anime illustration, polished digital art, studio-quality, "
    "simple white background, solid background"
)

NEGATIVE_PROMPT = (
    "face only, head only, cropped at neck, neck crop, too close, "
    "extreme closeup, floating head, no body, disembodied, full body, "
    "legs visible, waist visible, complex background, detailed background, "
    "blurry, low quality, bad anatomy, extra limbs, deformed, ugly, text, "
    "watermark, signature, nsfw"
)

MODIFIERS = {
    "Hair & Expression": [
        {"name": "Red Hair Peace",       "prompt": "red hair, peace sign, cheerful smile"},
        {"name": "Pink Hair Wink",       "prompt": "pink hair, winking, playful"},
        {"name": "Blonde Smug",          "prompt": "blonde hair, smug expression, confident"},
    ],
    "Props & Accessories": [
        {"name": "Boba Tea",             "prompt": "brown hair, sipping boba tea"},
        {"name": "Catgirl Lollipop",     "prompt": "orange hair, cat ears, lollipop, puffed cheeks"},
        {"name": "Cap Coffee",           "prompt": "baseball cap, holding coffee, shy expression"},
    ],
    "Gamer Variants": [
        {"name": "Headphones Jacket",    "prompt": "headphones, gaming jacket, confident"},
        {"name": "Catear Streamer",      "prompt": "cat ear headphones, streamer setup"},
        {"name": "Energy Drink",         "prompt": "headphones, energy drink, intense gaze"},
    ],
    "Street Style": [
        {"name": "Cap Chains",           "prompt": "cap, bubblegum, chain necklace, streetwear"},
        {"name": "Sunglasses Street",    "prompt": "sunglasses, bubblegum, street fashion"},
        {"name": "Purple Chains",        "prompt": "purple hair, cap, sunglasses, bubblegum, chains, earbuds"},
    ],
    "Archetypes & Fantasy": [
        {"name": "Mysterious Hoodie",    "prompt": "hoodie, face mask, mysterious, glowing eyes"},
        {"name": "Witch Hat",            "prompt": "witch hat, magical girl, mystical"},
        {"name": "Cyber White Hair",     "prompt": "white hair, glasses, choker, cyberpunk"},
    ],
    "Royalty": [
        {"name": "Royal Crown",          "prompt": "crown, royal cape, proud expression"},
        {"name": "Tiara Pearls",         "prompt": "small tiara, smug expression, elegant, pearl earrings, beauty mark, drill hair, ojou-sama style, looking down at viewer, fan covering mouth"},
        {"name": "Golden Tiara",         "prompt": "red hair, golden tiara, cheerful, warm smile"},
    ],
    "Scientists & Tech": [
        {"name": "Lab Coat Goggles",     "prompt": "lab coat, safety goggles, test tubes"},
        {"name": "VR Scientist",         "prompt": "VR visor, tech gear, futuristic scientist"},
        {"name": "Professor",            "prompt": "glasses, goatee, lab coat, thinking pose"},
    ],
    "Athletic & Combat": [
        {"name": "Boxer Intense",        "prompt": "boxing gloves, intense stare, fighter stance"},
        {"name": "Basketball",           "prompt": "red headband, basketball jersey, grin"},
        {"name": "Muscular Peace",       "prompt": "tank top, muscular, peace sign, wink"},
    ],
}

# ─── COMFYUI API ─────────────────────────────────────────────────────────

def build_workflow(positive_prompt, negative_prompt, seed=None, filename_prefix="avatar"):
    if seed is None:
        seed = random.randint(1, 2**53)
    return {
        "3": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": MODEL}
        },
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": BATCH_SIZE}
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive_prompt, "clip": ["3", 1]}
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative_prompt, "clip": ["3", 1]}
        },
        "10": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {"shift": SHIFT, "model": ["3", 0]}
        },
        "13": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["10", 0], "positive": ["6", 0], "negative": ["7", 0],
                "latent_image": ["5", 0], "seed": seed, "steps": STEPS,
                "cfg": CFG, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                "denoise": 1.00, "control_after_generate": "randomize"
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["13", 0], "vae": ["3", 2]}
        },
        "20": {
            "class_type": "BiRefNetRMBG",
            "inputs": {
                "image": ["8", 0], "model": "BiRefNet-general",
                "mask_blur": 0, "mask_offset": 0,
                "invert_output": False, "refine_foreground": False,
                "background": "Alpha", "background_color": "#222222"
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"images": ["20", 0], "filename_prefix": filename_prefix}
        }
    }


def queue_prompt(workflow):
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"error": f"HTTP {e.code}: {body[:200]}"}
    except urllib.error.URLError as e:
        return {"error": str(e)}


def get_history(prompt_id):
    try:
        req = urllib.request.Request(f"{COMFYUI_URL}/history/{prompt_id}")
        resp = urllib.request.urlopen(req, timeout=5)
        return json.loads(resp.read())
    except Exception:
        return {}


def get_queue():
    try:
        req = urllib.request.Request(f"{COMFYUI_URL}/queue")
        resp = urllib.request.urlopen(req, timeout=5)
        return json.loads(resp.read())
    except Exception:
        return {}


# ─── DISPLAY HELPERS ─────────────────────────────────────────────────────

SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

def banner():
    print(f"""
{C.ACCENT}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   {C.BOLD}WordWarz Avatar Batch Generator{C.RESET}{C.ACCENT}                           ║
║   {C.DIM}Automated ComfyUI Pipeline × NetaYume Lumina 3.5{C.RESET}{C.ACCENT}           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝{C.RESET}
""")


def show_config():
    print(f"  {C.DIM}{'─' * 58}{C.RESET}")
    print(f"  {C.CYAN}Model       {C.RESET}{MODEL}")
    print(f"  {C.CYAN}Resolution  {C.RESET}{WIDTH}×{HEIGHT}")
    print(f"  {C.CYAN}Steps       {C.RESET}{STEPS}  |  {C.CYAN}CFG  {C.RESET}{CFG}  |  {C.CYAN}Sampler  {C.RESET}{SAMPLER}")
    print(f"  {C.CYAN}Batch Size  {C.RESET}{BATCH_SIZE}  |  {C.CYAN}Scheduler  {C.RESET}{SCHEDULER}")
    print(f"  {C.CYAN}Shift       {C.RESET}{SHIFT}  |  {C.CYAN}BG Removal  {C.RESET}BiRefNet-general")
    print(f"  {C.DIM}{'─' * 58}{C.RESET}\n")


def show_library():
    total = sum(len(v) for v in MODIFIERS.values())
    print(f"  {C.ACCENT}▸ Prompt Library{C.RESET}  {C.DIM}({total} modifiers across {len(MODIFIERS)} categories){C.RESET}\n")
    for category, mods in MODIFIERS.items():
        print(f"    {C.YELLOW}{category}{C.RESET} {C.DIM}({len(mods)} variants){C.RESET}")
        for mod in mods:
            print(f"      {C.DIM}├─{C.RESET} {mod['name']}")
        print()


def show_base_prompt():
    print(f"  {C.ACCENT}▸ Base Prompt Template{C.RESET}\n")
    display = BASE_PROMPT.replace("{gender}", f"{C.YELLOW}{{gender}}{C.RESET}")
    print(f"    {C.DIM}\"{C.RESET}{display}{C.DIM}\"{C.RESET}")
    print(f"\n    {C.DIM}+ modifier appended per variant{C.RESET}")
    print(f"\n  {C.ACCENT}▸ Negative Prompt{C.RESET}\n")
    print(f"    {C.DIM}\"{NEGATIVE_PROMPT}\"{C.RESET}\n")


# ─── MAIN ────────────────────────────────────────────────────────────────

def main():
    banner()
    show_config()
    show_base_prompt()
    show_library()

    total = min(MAX_VARIANTS, sum(len(v) for v in MODIFIERS.values()))

    # ══════════════════════════════════════════════════════════════════════
    #  PHASE 1 — Queue all variants
    # ══════════════════════════════════════════════════════════════════════
    print(f"  {C.DIM}{'═' * 58}{C.RESET}")
    print(f"  {C.ACCENT}{C.BOLD}Phase 1 ─ Queuing {total} variants...{C.RESET}")
    print(f"  {C.DIM}{'═' * 58}{C.RESET}\n")

    queue_list = []  # [(prompt_id, variant_name, category, modifier)]
    queue_errors = 0
    num = 0

    for category, mods in MODIFIERS.items():
        if num >= total:
            break
        print(f"  {C.YELLOW}━━ {category} ━━{C.RESET}")

        for mod in mods:
            if num >= total:
                break
            num += 1
            gender = "boy" if any(w in mod["prompt"].lower() for w in ["goatee", "boxer", "basketball"]) else random.choice(["girl", "boy"])
            full_prompt = BASE_PROMPT.format(gender=gender) + ", " + mod["prompt"]
            seed = random.randint(1, 2**53)
            # Clean filename: "Hair & Expression/Red Hair Peace" → "hair-expression_red-hair-peace"
            cat_slug = category.lower().replace(" & ", "-").replace(" ", "-")
            name_slug = mod["name"].lower().replace(" ", "-")
            prefix = f"{cat_slug}_{name_slug}"
            workflow = build_workflow(full_prompt, NEGATIVE_PROMPT, seed, filename_prefix=prefix)

            result = queue_prompt(workflow)

            if "error" in result:
                print(f"    {C.RED}✗{C.RESET} {mod['name']}  {C.RED}{result['error']}{C.RESET}")
                queue_errors += 1
            else:
                prompt_id = result.get("prompt_id", "unknown")
                queue_list.append((prompt_id, mod["name"], category, mod["prompt"]))
                print(f"    {C.ACCENT}✓{C.RESET} {C.BOLD}{mod['name']}{C.RESET}  {C.DIM}→ queued ({num}/{total}){C.RESET}")

            time.sleep(0.15)  # slight delay for visual effect

        print()

    queued_count = len(queue_list)
    print(f"  {C.ACCENT}{C.BOLD}{queued_count} variants queued{C.RESET} {C.DIM}({queue_errors} errors){C.RESET}\n")

    if queued_count == 0:
        print(f"  {C.RED}Nothing to generate. Exiting.{C.RESET}")
        return

    # ══════════════════════════════════════════════════════════════════════
    #  PHASE 2 — Monitor generation progress
    # ══════════════════════════════════════════════════════════════════════
    print(f"  {C.DIM}{'═' * 58}{C.RESET}")
    print(f"  {C.MAGENTA}{C.BOLD}Phase 2 ─ Generating {queued_count} avatars...{C.RESET}")
    print(f"  {C.DIM}{'═' * 58}{C.RESET}\n")

    completed = 0
    gen_errors = 0
    start_time = time.time()
    spinner_idx = 0
    done_ids = set()

    while completed + gen_errors < queued_count:
        elapsed = time.time() - start_time
        spinner = SPINNER[spinner_idx % len(SPINNER)]
        spinner_idx += 1

        # Check each pending prompt
        newly_done = []
        for prompt_id, name, category, modifier in queue_list:
            if prompt_id in done_ids:
                continue
            history = get_history(prompt_id)
            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                if "9" in outputs:
                    filenames = [img.get("filename", "?") for img in outputs["9"].get("images", [])]
                    newly_done.append((prompt_id, name, category, modifier, filenames))
                    done_ids.add(prompt_id)

        # Print completed ones
        for prompt_id, name, category, modifier, filenames in newly_done:
            completed += 1
            pct = completed / queued_count
            bar_len = 30
            filled = int(bar_len * pct)
            bar = f"{'█' * filled}{'░' * (bar_len - filled)}"

            sys.stdout.write(C.CLEAR_LINE)
            sys.stdout.flush()
            print(f"    {C.ACCENT}[{bar}]{C.RESET} {C.DIM}{completed}/{queued_count}{C.RESET}")
            print(f"    {C.ACCENT}✓{C.RESET} {C.BOLD}{name}{C.RESET}  {C.DIM}({category}){C.RESET}")
            print(f"      {C.DIM}modifier:{C.RESET} {modifier}")
            for fn in filenames:
                print(f"      {C.DIM}→ saved:{C.RESET}  {fn}")
            print()

        # If still waiting, show spinner
        if completed + gen_errors < queued_count:
            remaining = queued_count - completed - gen_errors
            # Figure out what's currently running
            queue_info = get_queue()
            running = queue_info.get("queue_running", [])
            pending = queue_info.get("queue_pending", [])

            # Find current running variant name
            running_name = ""
            for item in running:
                if len(item) >= 2:
                    rid = item[1] if isinstance(item[1], str) else ""
                    for pid, name, cat, mod in queue_list:
                        if pid == rid and pid not in done_ids:
                            running_name = name
                            break

            status_parts = []
            if running_name:
                status_parts.append(f"{C.MAGENTA}Generating: {C.BOLD}{running_name}{C.RESET}")
            status_parts.append(f"{C.DIM}{remaining} remaining  |  {len(pending)} in queue  |  {elapsed:.0f}s{C.RESET}")

            sys.stdout.write(f"{C.CLEAR_LINE}    {C.CYAN}{spinner}{C.RESET} {'  '.join(status_parts)}")
            sys.stdout.flush()

        time.sleep(POLL_INTERVAL)

        # Timeout after 30 minutes total
        if elapsed > 1800:
            sys.stdout.write(C.CLEAR_LINE)
            sys.stdout.flush()
            print(f"\n  {C.RED}Timeout after 30 minutes.{C.RESET}")
            gen_errors = queued_count - completed
            break

    # Clear the spinner line
    sys.stdout.write(C.CLEAR_LINE)
    sys.stdout.flush()

    elapsed = time.time() - start_time

    # ══════════════════════════════════════════════════════════════════════
    #  SUMMARY
    # ══════════════════════════════════════════════════════════════════════
    print(f"  {C.DIM}{'═' * 58}{C.RESET}")
    print(f"""
  {C.ACCENT}{C.BOLD}Batch complete!{C.RESET}

    {C.CYAN}Generated      {C.RESET}{completed} / {queued_count} variants
    {C.CYAN}Images saved   {C.RESET}{completed * BATCH_SIZE} avatars
    {C.CYAN}Errors         {C.RESET}{queue_errors + gen_errors}
    {C.CYAN}Time elapsed   {C.RESET}{elapsed:.1f}s
    {C.CYAN}Avg per avatar {C.RESET}{elapsed / max(completed, 1):.1f}s
    {C.CYAN}Output         {C.RESET}ComfyUI/output/

  {C.DIM}{'═' * 58}{C.RESET}
""")


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    main()
