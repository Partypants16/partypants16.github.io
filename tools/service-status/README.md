# Service status

The Online / Offline dots on the home page's self-hosted cards.

GitHub Pages can't reach the home network, so the remote box does the
checking and publishes the result somewhere the page can read:

1. **`check_services.py`** runs on the remote box (`parth-Surface-Book`) from
   cron every 5 minutes. It sends a request to each service's URL (any HTTP
   answer below 500 counts as up, with one retry), then writes the result to
   a secret GitHub Gist. It only publishes when something changes, or every
   15 minutes otherwise.
2. **`service-status.js`** on the home page fetches the gist's `status.json`
   and adds a dot to every card that has a `data-service="<id>"` attribute.
   If the gist hasn't been updated for about 40 minutes, the cards show
   **Unknown** (the box is probably off). If the gist can't be loaded at all,
   nothing is shown.

## On the box

| What | Where |
|---|---|
| Script (a copy of the one here) | `~/service-status/check_services.py` |
| Cron entry (`crontab -l`) | `*/5 * * * * /usr/bin/python3 /home/parth/service-status/check_services.py >> /home/parth/service-status/status.log 2>&1` |
| Latest result | `~/service-status/status.json` |
| Status changes and errors | `~/service-status/status.log` (keeps the last 1000 lines) |
| GitHub token (gist access only) | `~/.config/service-status/github-token` |
| Gist id (made on the first publish) | `~/.config/service-status/gist-id` |

Run it by hand with `python3 ~/service-status/check_services.py -v`. Add
`--force` to publish straight away.

## Changes

- **Add or remove a service:** edit `SERVICES` in `check_services.py`, copy
  it to the box, and set `data-service` on the card in `index.html` to the
  same id.
- **Token expired or replaced:** paste the new token over
  `~/.config/service-status/github-token`. The log shows `HTTP 401` while
  it's wrong or expired.
- **Switch it off:** remove the cron line (`crontab -e`). To also hide the
  dots, set `STATUS_URL` in `service-status.js` to `""`.
