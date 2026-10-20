// Quotes under the clock on the Wallpaper page. Each wallpaper names a set
// (quotes: "racing" in its WP.register call), or gets "general". A new quote is
// picked every day. The settings panel can pin the motto instead, or hide it.
// The LOVELESS wallpaper shows its own lines from the poem.
//
// To add one: put { text: "...", by: "Who said it" } in a set. Leave "by" out
// for your own. Only add quotes you know who really said.

const WALLPAPER_QUOTES = {
  motto: { text: "Put in everything you got, then ponder about it later" },

  sets: {
    general: [
      { text: "Put in everything you got, then ponder about it later" },
      { text: "The best way to predict the future is to invent it.", by: "Alan Kay" },
      { text: "Simplicity is prerequisite for reliability.", by: "Edsger W. Dijkstra" },
      { text: "Talk is cheap. Show me the code.", by: "Linus Torvalds" },
      { text: "Make it work, make it right, make it fast.", by: "Kent Beck" },
      { text: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe" },
      { text: "The impediment to action advances action. What stands in the way becomes the way.", by: "Marcus Aurelius, Meditations" },
      { text: "A journey of a thousand miles begins with a single step.", by: "Lao Tzu" },
      { text: "Fortune favours the bold.", by: "Latin proverb" }
    ],
    racing: [
      { text: "If you no longer go for a gap that exists, you are no longer a racing driver.", by: "Ayrton Senna" },
      { text: "Leave me alone, I know what I'm doing.", by: "Kimi Räikkönen, Abu Dhabi 2012" },
      { text: "Still we rise.", by: "Lewis Hamilton" },
      { text: "GP2 engine! GP2!", by: "Fernando Alonso, Suzuka 2015" },
      { text: "Simply lovely.", by: "Max Verstappen" },
      { text: "Put in everything you got, then ponder about it later" }
    ],
    ff7: [
      { text: "Embrace your dreams. And whatever happens, protect your honor.", by: "Angeal, Crisis Core" },
      { text: "Let's mosey.", by: "Cloud, Final Fantasy VII" },
      { text: "There ain't no gettin' offa this train we on!", by: "Barret, Final Fantasy VII" },
      { text: "Not interested.", by: "Cloud, Final Fantasy VII" },
      { text: "The price of freedom is steep.", by: "Zack, Crisis Core" }
    ],
    space: [
      { text: "The cosmos is within us. We are made of star-stuff.", by: "Carl Sagan, Cosmos" },
      { text: "Do. Or do not. There is no try.", by: "Yoda, The Empire Strikes Back" },
      { text: "Space is big. Really big.", by: "Douglas Adams, The Hitchhiker's Guide to the Galaxy" },
      { text: "Put in everything you got, then ponder about it later" }
    ],
    music: [
      { text: "Without music, life would be a mistake.", by: "Friedrich Nietzsche" },
      { text: "One good thing about music, when it hits you, you feel no pain.", by: "Bob Marley, Trenchtown Rock" },
      { text: "Put in everything you got, then ponder about it later" }
    ],
    gaming: [
      { text: "It's dangerous to go alone! Take this.", by: "The Legend of Zelda" },
      { text: "Do a barrel roll!", by: "Peppy, Star Fox 64" },
      { text: "War. War never changes.", by: "Fallout" },
      { text: "The cake is a lie.", by: "Portal" },
      { text: "Put in everything you got, then ponder about it later" }
    ],
    focus: [
      { text: "Put in everything you got, then ponder about it later" },
      { text: "Make it work, make it right, make it fast.", by: "Kent Beck" },
      { text: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe" }
    ]
  }
};
