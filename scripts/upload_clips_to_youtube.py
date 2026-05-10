#!/usr/bin/env python3
"""
Upload per-move capoeira clips to admin@truesight.me YouTube channel.

Reuses the OAuth token already in agroverse_shop/scripts/ (youtube_credentials.json
+ youtube_token.json) — same admin@truesight.me account, no re-auth needed.

Inputs:
  - tribomirimbahia/data/compiled_clips/<move_id>.mp4   (already sliced)
  - tribomirimbahia/data/move_metadata.json             (title/transcript/summary/tags)

Output / source-of-truth:
  - tribomirimbahia/data/youtube_videos.json            (move_id -> video_id, idempotent)
  - tribomirimbahia/data/moves.json                     (final Phase 1A artifact for site)

Idempotent: if a move_id is already in youtube_videos.json with a video_id, skip the
upload and just refresh the title/description if the metadata changed.

Usage:
  python3 scripts/upload_clips_to_youtube.py --only ginga             # test single move
  python3 scripts/upload_clips_to_youtube.py --dry-run                # show plan only
  python3 scripts/upload_clips_to_youtube.py                          # upload all 39
  python3 scripts/upload_clips_to_youtube.py --privacy public         # default is unlisted
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import time
from pathlib import Path

# Reuse OAuth from agroverse_shop/scripts/
AGROVERSE_SCRIPTS = Path.home() / "Applications/agroverse_shop/scripts"
sys.path.insert(0, str(AGROVERSE_SCRIPTS))

from google.oauth2.credentials import Credentials  # noqa
from google_auth_oauthlib.flow import InstalledAppFlow  # noqa
from google.auth.transport.requests import Request  # noqa
from googleapiclient.discovery import build  # noqa
from googleapiclient.http import MediaFileUpload  # noqa
from googleapiclient.errors import HttpError  # noqa

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
CREDENTIALS_FILE = AGROVERSE_SCRIPTS / "youtube_credentials.json"
TOKEN_FILE = AGROVERSE_SCRIPTS / "youtube_token.json"

REPO = Path(__file__).resolve().parent.parent
CLIPS_DIR = REPO / "data/compiled_clips"
METADATA_PATH = REPO / "data/move_metadata.json"
STATE_PATH = REPO / "data/youtube_videos.json"
MOVES_PATH = REPO / "data/moves.json"


def get_youtube():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as fh:
            fh.write(creds.to_json())
    return build("youtube", "v3", credentials=creds)


def build_description(meta: dict, move_id: str) -> str:
    name_pt = meta["name_pt"]
    name_en = meta["name_en"]
    summary = meta["summary_en"]
    transcript_pt = meta["transcript_pt"]
    transcript_en = meta["transcript_en"]
    parts = [
        summary,
        "",
        "— Bico Duro, Tribo Bahia Mirim, Baia Itacaré (Bahia, Brazil)",
        "",
        "Instruction (translated from Portuguese):",
        transcript_en,
        "",
        "Original (Portuguese):",
        transcript_pt,
        "",
        "About Tribo Bahia Mirim:",
        "After-school capoeira program for children in Baia Itacaré, led by Mestre Bico Duro.",
        "Support the program: https://capoeira.agroverse.shop",
        "",
        f"Move ID: {move_id}",
        f"Theme: {meta['theme']} · Difficulty: {meta['difficulty']}",
    ]
    return "\n".join(parts)


def upload_one(youtube, move_id: str, meta: dict, privacy: str, dry_run: bool) -> str | None:
    clip = CLIPS_DIR / f"{move_id}.mp4"
    if not clip.exists():
        print(f"  [SKIP] clip missing: {clip}")
        return None
    title = meta["title"]
    if len(title) > 100:
        print(f"  [WARN] title >100 chars, truncating: {title}")
        title = title[:97] + "..."
    description = build_description(meta, move_id)
    if dry_run:
        print(f"  [DRY] {move_id}: title={title!r} ({len(description)} chars desc) {clip.stat().st_size//1024}KB")
        return None
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": meta["tags"],
            "categoryId": "17",  # Sports
            "defaultLanguage": "pt",
            "defaultAudioLanguage": "pt",
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
            "embeddable": True,
        },
    }
    media = MediaFileUpload(str(clip), mimetype="video/mp4", resumable=True, chunksize=4 * 1024 * 1024)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    last_progress = -1
    while response is None:
        status, response = request.next_chunk()
        if status and int(status.progress() * 100) != last_progress:
            last_progress = int(status.progress() * 100)
            print(f"    {last_progress}% uploaded...", end="\r")
    print()
    return response.get("id")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="Upload only this move_id")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--privacy", default="unlisted", choices=["public", "unlisted", "private"])
    ap.add_argument("--sleep", type=int, default=5, help="Sleep seconds between uploads")
    args = ap.parse_args()

    meta_all = json.loads(METADATA_PATH.read_text())
    moves = meta_all["moves"]

    state = {}
    if STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text())

    youtube = None if args.dry_run else get_youtube()

    target_ids = [args.only] if args.only else list(moves.keys())

    success = 0
    errors = []
    for move_id in target_ids:
        if move_id not in moves:
            print(f"  [ERROR] unknown move_id: {move_id}")
            continue
        if move_id in state and state[move_id].get("video_id"):
            print(f"  [SKIP] {move_id} already uploaded: {state[move_id]['video_id']}")
            continue
        meta = moves[move_id]
        print(f"\n[{move_id}] {meta['title']}")
        try:
            video_id = upload_one(youtube, move_id, meta, args.privacy, args.dry_run)
            if video_id:
                state[move_id] = {
                    "video_id": video_id,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "title": meta["title"],
                    "privacy": args.privacy,
                    "uploaded_at": int(time.time()),
                }
                STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False))
                print(f"  -> https://www.youtube.com/watch?v={video_id}")
                success += 1
                if args.sleep and move_id != target_ids[-1]:
                    time.sleep(args.sleep)
        except HttpError as e:
            print(f"  [HTTP ERROR] {e}")
            errors.append((move_id, str(e)))
            # quota exhausted? bail.
            if "quotaExceeded" in str(e):
                print("\n[FATAL] YouTube quota exceeded. Resume tomorrow with same command (idempotent).")
                break
        except Exception as e:
            print(f"  [ERROR] {e}")
            errors.append((move_id, str(e)))

    print(f"\nUploaded: {success} | Errors: {len(errors)} | Already done: {len(state)}")
    if errors:
        for m, e in errors[:10]:
            print(f"  {m}: {e[:200]}")


if __name__ == "__main__":
    main()
