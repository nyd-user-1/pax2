#!/usr/bin/env bash
# Connect PAX to Discord: check the PAX bot's token, store it and the server id in SSM, and print the
# link that invites the bot to the server. After govblock's scripts/agents/connect-discord-bot.sh.
#
#   scripts/connect-discord.sh <bot-token> [server-id]
#
# Before this, at https://discord.com/developers/applications:
#   1. New Application, named PAX. Bot -> Reset Token -> copy it.
#   2. Bot -> Privileged Gateway Intents -> Message Content Intent ON. Without it, Discord returns every
#      message's text empty.
#   3. Run this script, then open the invite link it prints and add the bot to the server. The link asks
#      for View Channels, Read Message History, Send Messages, Send Messages in Threads and Manage
#      Webhooks; PAX posts through one webhook per channel so each post carries its writer's name.
#
# The server id defaults to the NYSgpt server (govblock's). The token is never echoed or written to a file.
set -euo pipefail

TOKEN="${1:-}"
GUILD="${2:-1537459604626219018}"
REGION="${AWS_REGION:-us-east-1}"
PERMISSIONS=275414846464

if [ -z "$TOKEN" ]; then
  echo "usage: $0 <bot-token> [server-id]" >&2
  exit 64
fi

echo "Checking the token with Discord"
APP=$(curl -sS -H "Authorization: Bot $TOKEN" -H 'User-Agent: pax2/1' https://discord.com/api/v10/oauth2/applications/@me)
if ! grep -q '"id"' <<<"$APP"; then
  echo "Discord rejected the token: $APP" >&2
  exit 1
fi
APP_ID=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["id"])' <<<"$APP")
python3 -c 'import json,sys; d=json.load(sys.stdin); print("  application:", d.get("name"), "· id", d.get("id"))' <<<"$APP"

echo "Writing /pax2/discord/bot-token and /pax2/discord/guild-id"
aws ssm put-parameter --region "$REGION" --name /pax2/discord/bot-token --type SecureString --overwrite --value "$TOKEN" --query Version --output text >/dev/null
aws ssm put-parameter --region "$REGION" --name /pax2/discord/guild-id --type SecureString --overwrite --value "$GUILD" --query Version --output text >/dev/null

echo "Is the bot in the server?"
G=$(curl -sS -H "Authorization: Bot $TOKEN" -H 'User-Agent: pax2/1' "https://discord.com/api/v10/guilds/$GUILD")
if grep -q '"name"' <<<"$G"; then
  python3 -c 'import json,sys; print("  yes:", json.load(sys.stdin).get("name"))' <<<"$G"
  echo "Done. The PAX side panel's Discord row lists the server's channels within five minutes."
else
  echo "  not yet. Open this link, pick the server and authorize:"
  echo "  https://discord.com/oauth2/authorize?client_id=$APP_ID&scope=bot&permissions=$PERMISSIONS&guild_id=$GUILD"
fi
