// Movie recommendation lists, one per person.
// The key (e.g. "test") is what goes in the link: movie-list.html?for=test
// Each movie needs a title and rating; comment is optional.
// note is optional too and may contain HTML (e.g. a link).

const MOVIE_LISTS = {
  test: {
    name: "Test",
    note: 'Sample list for this prototype. The titles are the top 25 of <a href="https://letterboxd.com/fcbarcelona/list/movies-everyone-should-watch-at-least-once/" target="_blank" rel="noopener noreferrer">Movies everyone should watch at least once</a>, a Letterboxd list crowd-sourced from Reddit\'s r/movies. The ratings and comments are made up.',
    movies: [
      { title: "Psycho", rating: "9/10", comment: "Still the blueprint for every twist ending." },
      { title: "2001: A Space Odyssey", rating: "8/10", comment: "Slow, but watch it on the biggest screen you can find." },
      { title: "Schindler's List", rating: "10/10", comment: "Hard to watch, harder to forget." },
      { title: "GoodFellas", rating: "9/10" },
      { title: "Back to the Future", rating: "9/10", comment: "Perfect Friday night movie." },
      { title: "Lawrence of Arabia", rating: "8/10", comment: "It's long, so pick a free afternoon." },
      { title: "The Virgin Suicides", rating: "7/10" },
      { title: "Come and See", rating: "9/10", comment: "The most intense war film I know. Not a casual watch." },
      { title: "The Prince of Egypt", rating: "8/10", comment: "The soundtrack alone is worth it." },
      { title: "The Princess Bride", rating: "9/10", comment: "Funny, sweet and endlessly quotable." },
      { title: "Spirited Away", rating: "10/10", comment: "Start here if you've never seen a Ghibli film." },
      { title: "The Shawshank Redemption", rating: "10/10" },
      { title: "Mad Max: Fury Road", rating: "9/10", comment: "Two hours of pure momentum." },
      { title: "12 Angry Men", rating: "9/10", comment: "Almost all in one room, and it's gripping the whole way." },
      { title: "High and Low", rating: "8/10" },
      { title: "Spider-Man: Into the Spider-Verse", rating: "9/10", comment: "The best Spider-Man movie, and it isn't close." },
      { title: "Ikiru", rating: "8/10" },
      { title: "The Apartment", rating: "8/10", comment: "Funny and sad at the same time." },
      { title: "Fight Club", rating: "8/10", comment: "Go in knowing as little as possible." },
      { title: "Do the Right Thing", rating: "9/10" },
      { title: "Jojo Rabbit", rating: "8/10", comment: "Silly until it suddenly isn't." },
      { title: "Heat", rating: "9/10", comment: "Worth it for the bank robbery scene alone." },
      { title: "Children of Men", rating: "9/10", comment: "Watch for the long one-take scenes." },
      { title: "Citizen Kane", rating: "7/10", comment: "More impressive than fun, but you'll get all the references after." },
      { title: "Harakiri", rating: "9/10" }
    ]
  }
};
