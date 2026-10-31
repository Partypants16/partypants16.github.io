# Static Spotify Listening History Showcase Guide

This guide details how to build a performant, static Spotify listening history dashboard for a personal website or portfolio.

## Architecture Overview

Instead of parsing raw JSON exports directly in the visitor's browser (which can involve tens of megabytes of data), this approach uses a **two-tier architecture**:

1. **Local Preprocessing (Python):** Process raw Spotify export files locally to filter skips, aggregate metrics, and export a lightweight `spotify_summary.json` file (typically under 20 KB).
2. **Frontend Rendering (HTML/JS + Chart.js):** Load the summary JSON file on your static site to render animated graphs and key stat cards with minimal performance overhead.

---

## Step 1: Preprocess Raw Data (Python)

Save the script below in the directory where your Spotify JSON files reside (`endsong_*.json` or `StreamingHistory*.json`). Run it using Python with `pandas` installed (`pip install pandas`).

```python
import glob
import json
import pandas as pd

# 1. Load all Spotify JSON files in the current folder
files = glob.glob("endsong_*.json") or glob.glob("StreamingHistory*.json")
if not files:
    raise FileNotFoundError("No Spotify history files found.")

raw_data = []
for file in files:
    with open(file, "r", encoding="utf-8") as f:
        raw_data.extend(json.load(f))

df = pd.DataFrame(raw_data)

# 2. Normalize schema across standard and extended history formats
artist_col = (
    "master_metadata_album_artist_name"
    if "master_metadata_album_artist_name" in df.columns
    else "artistName"
)
track_col = (
    "master_metadata_track_name"
    if "master_metadata_track_name" in df.columns
    else "trackName"
)
time_col = "ts" if "ts" in df.columns else "endTime"

# Filter out null entries and plays shorter than 30 seconds (skips)
df = df.dropna(subset=[artist_col, track_col])
df = df[df["ms_played"] >= 30000]

# 3. Parse Dates
df["dt"] = pd.to_datetime(df[time_col])
df["hours_played"] = df["ms_played"] / (1000 * 60 * 60)
df["month_year"] = df["dt"].dt.strftime("%Y-%m")
df["hour"] = df["dt"].dt.hour

# 4. Compute Metrics
total_hours = round(df["hours_played"].sum(), 1)
total_plays = len(df)
unique_artists = df[artist_col].nunique()
unique_tracks = df[track_col].nunique()

# Top 10 Artists
top_artists = (
    df.groupby(artist_col)["hours_played"]
    .sum()
    .nlargest(10)
    .round(1)
    .to_dict()
)

# Top 10 Tracks
top_tracks = (
    df.groupby([track_col, artist_col])["hours_played"]
    .sum()
    .nlargest(10)
    .round(1)
    .reset_index()
)
top_tracks_list = [
    {"track": row[track_col], "artist": row[artist_col], "hours": row["hours_played"]}
    for _, row in top_tracks.iterrows()
]

# Monthly Trend (Hours per Month)
monthly_trend = (
    df.groupby("month_year")["hours_played"].sum().round(1).to_dict()
)

# Hourly Activity Distribution (24-hour cycle)
hourly_dist = (
    df.groupby("hour")["hours_played"].sum().round(1).to_dict()
)
hourly_list = [round(hourly_dist.get(h, 0), 1) for h in range(24)]

# 5. Output Summary JSON
summary = {
    "overview": {
        "totalHours": total_hours,
        "totalPlays": total_plays,
        "uniqueArtists": unique_artists,
        "uniqueTracks": unique_tracks,
    },
    "topArtists": top_artists,
    "topTracks": top_tracks_list,
    "monthlyTrend": monthly_trend,
    "hourlyHabits": hourly_list,
}

with open("spotify_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("Successfully generated spotify_summary.json!")
```

---

## Step 2: Data Schema Reference (`spotify_summary.json`)

Place the generated `spotify_summary.json` inside your site's public or asset directory. The JSON structure will reflect the following layout:

```json
{
  "overview": {
    "totalHours": 1420.5,
    "totalPlays": 28450,
    "uniqueArtists": 1240,
    "uniqueTracks": 4120
  },
  "topArtists": {
    "Kendrick Lamar": 112.4,
    "Radiohead": 98.2,
    "Daft Punk": 85.1
  },
  "topTracks": [
    { "track": "Starless", "artist": "King Crimson", "hours": 14.2 }
  ],
  "monthlyTrend": {
    "2023-01": 110.2,
    "2023-02": 95.4
  },
  "hourlyHabits": [12.1, 5.0, 1.2, 0.5, 0.0, 0.0, 2.1, 8.4, 15.2, 22.1, 30.0, 35.1, 40.2, 38.0, 32.1, 28.4, 30.1, 35.0, 42.1, 45.2, 38.1, 25.0, 18.2, 14.0]
}
```

---

## Step 3: Frontend Implementation (HTML + JavaScript)

Use this boilerplate to fetch `spotify_summary.json` and display key figures and charts using **Chart.js**.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Listening Showcase</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      background-color: #121212;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #181818;
      padding: 1.2rem;
      border-radius: 8px;
      border: 1px solid #282828;
    }
    .card h3 { 
      margin: 0; 
      font-size: 0.85rem; 
      color: #B3B3B3; 
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card p { 
      margin: 0.5rem 0 0 0; 
      font-size: 1.8rem; 
      font-weight: bold; 
      color: #1DB954; 
    }
    .chart-box {
      background: #181818;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      border: 1px solid #282828;
    }
    .chart-box h2 {
      margin-top: 0;
      font-size: 1.2rem;
      color: #FFFFFF;
    }
  </style>
</head>
<body>

  <h1>Listening History Showcase</h1>

  <!-- Overview Cards -->
  <div class="metrics-grid">
    <div class="card"><h3>Total Listen Time</h3><p id="total-hours">-</p></div>
    <div class="card"><h3>Total Track Plays</h3><p id="total-plays">-</p></div>
    <div class="card"><h3>Unique Artists</h3><p id="unique-artists">-</p></div>
  </div>

  <!-- Charts -->
  <div class="chart-box">
    <h2>Top 10 Artists (Hours Listened)</h2>
    <canvas id="artistsChart"></canvas>
  </div>

  <div class="chart-box">
    <h2>Listening Activity by Hour of Day</h2>
    <canvas id="hourlyChart"></canvas>
  </div>

  <script>
    async function loadSpotifyDashboard() {
      try {
        // Fetch pre-baked JSON summary
        const res = await fetch('spotify_summary.json');
        const data = await res.json();

        // Populate Card Metrics
        document.getElementById('total-hours').innerText = `${data.overview.totalHours} hrs`;
        document.getElementById('total-plays').innerText = data.overview.totalPlays.toLocaleString();
        document.getElementById('unique-artists').innerText = data.overview.uniqueArtists.toLocaleString();

        // Chart.js Global Theme Settings
        Chart.defaults.color = '#B3B3B3';
        Chart.defaults.borderColor = '#282828';

        // Render Top Artists Chart
        new Chart(document.getElementById('artistsChart'), {
          type: 'bar',
          data: {
            labels: Object.keys(data.topArtists),
            datasets: [{
              label: 'Hours Played',
              data: Object.values(data.topArtists),
              backgroundColor: '#1DB954',
              borderRadius: 4
            }]
          },
          options: { 
            indexAxis: 'y', 
            responsive: true,
            plugins: { legend: { display: false } } 
          }
        });

        // Render Hourly Habits Chart
        const hoursLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
        new Chart(document.getElementById('hourlyChart'), {
          type: 'line',
          data: {
            labels: hoursLabels,
            datasets: [{
              label: 'Hours',
              data: data.hourlyHabits,
              borderColor: '#1DB954',
              backgroundColor: 'rgba(29, 185, 84, 0.1)',
              fill: true,
              tension: 0.3
            }]
          },
          options: { 
            responsive: true,
            plugins: { legend: { display: false } } 
          }
        });
      } catch (error) {
        console.error('Error loading Spotify statistics:', error);
      }
    }

    loadSpotifyDashboard();
  </script>
</body>
</html>
```

---

## Step 4: Suggested Enhancements

1. **Artist Artwork Integration:** Use Spotify's Web API (`spotipy` Python package) during step 1 to fetch artist profile image URLs using the Spotify Web API and append those URLs directly into `spotify_summary.json`.
2. **Multi-Year Filtering:** Group metrics by year (`2022`, `2023`, `2024`, `All Time`) within Python and structure the JSON with year keys to allow visitors to toggle between listening years.
3. **Automated Deployment:** Add `spotify_summary.json` directly to your Git repository so your static build pipeline (GitHub Pages, Vercel, Netlify) automatically serves the latest data without requiring dynamic database calls.