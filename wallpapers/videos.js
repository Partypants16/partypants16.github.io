// The two video wallpapers. Each video has a still frame next to it (made by
// tools/build_wallpaper_images.py), shown instead on phones, with data saver,
// or when Settings → Movement is Still.

(function () {
  const VIDEOS = [
    { id: "winter-forest", name: "Winter Forest", file: "winter-forest-snow", quotes: "general", blurb: "Snow falling through a misty pine forest." },
    { id: "ff7-remake", name: "FF7 Remake", file: "FF7-remake", quotes: "ff7", blurb: "The party on the edge of Midgar." }
  ];

  VIDEOS.forEach(video => WP.register({
    id: video.id,
    name: video.name,
    group: "video",
    blurb: video.blurb,
    quotes: video.quotes,
    thumb: "wallpaper-files/thumbs/" + video.file + ".jpg",
    mount(ctx) {
      ctx.video("wallpaper-files/" + video.file + ".mp4", "wallpaper-files/" + video.file + ".jpg");
    }
  }));
})();
