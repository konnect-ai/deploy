import os
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from flask import Flask, request, jsonify
import requests

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

# Load config
with open("discord_automation_config.json", "r", encoding="utf-8") as f:
    config = json.load(f)

WEBHOOKS      = config["webhooks"]
EMOJI_MAP     = config["emoji_map"]
ACTIONS       = config["actions"]
DISPLAY_NAME  = config["display_name"]
TIMEZONE      = config["timezone"]
DT_FORMAT     = config["datetime_format"]

def get_timestamp():
    now = datetime.now(ZoneInfo("UTC")).astimezone(ZoneInfo(TIMEZONE))
    return now.strftime(DT_FORMAT)

def make_embed(title_emoji, title_text, fields, color=0x3498DB):
    embed = {"title": f"{title_emoji} {title_text}", "color": color, "fields": []}
    for name, value, inline in fields:
        embed["fields"].append({"name": name, "value": value, "inline": inline})
    return embed

def send(webhook_url, embed):
    payload = {"embeds": [embed]}
    resp = requests.post(webhook_url, json=payload)
    logging.info(f"Sent to {webhook_url}: {resp.status_code}")
    return resp

@app.route("/webhook/discord", methods=["POST"])
def webhook_handler():
    data = request.get_json()
    if not data or "type" not in data or "cmd" not in data:
        return jsonify({"error": "Bad payload"}), 400

    typ     = data["type"]
    cmd     = data["cmd"]
    content = data.get("content", "")
    date, time = get_timestamp().split(" ")

    if typ == "confirmation":
        emoji = EMOJI_MAP.get(cmd, "")
        title = f"🫡 {emoji} Réception confirmée, Général K ({cmd})"
        fields = [
            ("📅 Date", date, True),
            ("⏰ Heure", time, True),
            ("📌 Ordre reçu", content or "_(pas de contenu)_", False),
            ("🛠️ À faire", "- …", False),
            ("🔄 À continuer", "- …", False),
            ("✅ À valider", "- …", False)
        ]
        emb = make_embed("", title, fields, color=0x2ECC71)

        targets = list(WEBHOOKS.keys()) if cmd == "All" else [cmd]
        for t in targets:
            url = WEBHOOKS.get(t)
            if url: send(url, emb)

        label  = DISPLAY_NAME.get(cmd, cmd)
        recips = ", ".join(targets)
        log_fields = [
            ("📅 Date", date, True),
            ("⏰ Heure", time, True),
            ("✳️ Commande", label, False),
            ("📩 Envoyé à", recips, False),
            ("📦 Contenu", content or "_(pas de contenu)_", False)
        ]
        log_ent = make_embed("📶", "EventCenter Log 📡", log_fields)
        send(WEBHOOKS["EventCenter"], log_ent)

    elif typ == "assignment":
        action = data.get("action", "").lower()
        info   = ACTIONS.get(action)
        if not info:
            return jsonify({"error": "Unknown action"}), 400

        cmd_emoji = EMOJI_MAP.get(cmd, "")
        title     = f"{info['emoji']} {info['title']} – {cmd_emoji} {cmd}"
        fields    = [
            ("📅 Date", date, True),
            ("⏰ Heure", time, True),
        ]
        if content:
            fields.append(("📋 Détails", content, False))
        emb = make_embed("", title, fields, color=0xFFA500)

        target_url = WEBHOOKS.get(cmd)
        if target_url: send(target_url, emb)
        send(WEBHOOKS["BureauDuQG"], emb)

        action_label = f"{info['title']} {info['emoji']}"
        log_fields = [
            ("📅 Date", date, True),
            ("⏰ Heure", time, True),
            ("🎯 Action", action_label, False),
            ("📩 Destinataire", f"{cmd_emoji} {cmd}", False),
            ("📋 Contenu", content or "_(pas de contenu)_", False),
        ]
        log_ent = make_embed("📶", "EventCenter Log 📡", log_fields)
        send(WEBHOOKS["EventCenter"], log_ent)

    else:
        return jsonify({"error": "Invalid type"}), 400

    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
