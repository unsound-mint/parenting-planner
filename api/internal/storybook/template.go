package storybook

import (
	"strings"
	"unicode"
)

// The built-in story. It is what production shows without a key, so it is
// written to be read aloud: short lines, a rhythm, the child's name often, and
// the parent's own memory lines quoted as they wrote them (they are first
// person, so they are framed as "Mama remembers", not spliced into narration).

type themeText struct {
	title       string
	open        [2]Page
	bridge      Page
	close       [2]Page
	memoryArt   [MaxMemories]string
	memoryFrame [MaxMemories]string
}

// {N} is the child's first name, {S} what the child calls the parent.
var themeTexts = map[Theme]themeText{
	Bedtime: {
		title: "{N} and the Sleepy Moon",
		open: [2]Page{
			{"The sky outside {N}'s window turned soft and blue. The moon came up slowly, round and kind, to say goodnight.", "moon"},
			{"“Before you sleep,” said {S}, “shall we remember some of our best days?” {N} snuggled in close and listened.", "cuddle"},
		},
		bridge: Page{"One by one, the stars blinked on, as if they wanted to hear the stories too.", "stars"},
		close: [2]Page{
			{"Each memory floated up like a little lantern and settled among the stars, where it will always stay.", "stars"},
			{"“Goodnight, {N},” whispered {S}. “We love you all the way to the moon and back again.” And {N}'s eyes closed, slow and sleepy.", "moon"},
		},
		memoryArt: [MaxMemories]string{"hearts", "home", "garden", "cuddle"},
	},
	Adventure: {
		title: "{N}'s Big Little Adventure",
		open: [2]Page{
			{"One bright morning, {N} woke up with a feeling. Today, it whispered, is a day for adventure.", "sunrise"},
			{"{S} packed a snack, two hats and a whole lot of curiosity. “Where shall we go first?” {N} already knew.", "journey"},
		},
		bridge: Page{"Along the path, the leaves waved hello, and a small bird hopped beside them just to see what would happen next.", "garden"},
		close: [2]Page{
			{"By the end of the day, {N}'s pockets were full of tiny treasures, and {N}'s heart was full of big ones.", "journey"},
			{"Back home, {S} folded the day away like a map. “Same time tomorrow, explorer?” {N} smiled. Of course.", "home"},
		},
		memoryArt: [MaxMemories]string{"garden", "journey", "sunrise", "hearts"},
	},
	Born: {
		title: "The Day You Arrived, {N}",
		open: [2]Page{
			{"Before you came, {N}, we waited and wondered. What would your little face look like? How would your hand feel in ours?", "sunrise"},
			{"And then one day, there you were. The whole world seemed to go quiet, just to say hello to you.", "hearts"},
		},
		bridge: Page{"We counted your fingers and your toes. Ten and ten. Perfect, we said, and we said it again and again.", "cuddle"},
		close: [2]Page{
			{"That night the stars shone a little brighter. We think they knew someone wonderful had arrived.", "stars"},
			{"You are our favorite hello, {N}. We are so glad you are here. A big hug from {S}.", "cuddle"},
		},
		memoryArt: [MaxMemories]string{"cuddle", "home", "hearts", "stars"},
	},
	Sibling: {
		title: "{N} and the New Baby",
		open: [2]Page{
			{"Something special is happening in {N}'s family. Someone very small is on the way.", "home"},
			{"“A new baby?” asked {N}. “Yes,” said {S}. “And that baby is lucky, because that baby will have you.”", "hearts"},
		},
		bridge: Page{"Babies are tiny. They sleep a lot, they need lots of cuddles, and they love to watch big kids like {N} play.", "garden"},
		close: [2]Page{
			{"There is room in our hearts for everyone. Hearts are like that: they grow bigger whenever someone new arrives.", "hearts"},
			{"“You will always be our {N},” said {S}, and gave the biggest hug of all.", "cuddle"},
		},
		memoryArt: [MaxMemories]string{"cuddle", "garden", "stars", "hearts"},
	},
}

var memoryFrames = [MaxMemories]string{
	"Here is a true thing {S} remembers: “{M}”",
	"And {S} will never forget this one: “{M}”",
	"{S} keeps this memory close, like a warm pebble in a pocket: “{M}”",
	"One more, because it is a favorite: “{M}”",
}

func fill(s string, f Facts, memory string) string {
	return strings.NewReplacer("{N}", f.ChildName, "{S}", f.SignedAs, "{M}", memory).Replace(s)
}

// sentence makes a memory line end like a sentence and start with a capital.
func sentence(m string) string {
	m = strings.TrimRight(m, " ,;:-")
	if m == "" {
		return m
	}
	r := []rune(m)
	r[0] = unicode.ToUpper(r[0])
	m = string(r)
	if !strings.ContainsAny(m[len(m)-1:], ".!?") {
		m += "."
	}
	return m
}

// Template writes the story from fixed text: two opening pages, the memories
// with a quiet page after the first, and two closing pages. One to four
// memories make six to nine pages.
func Template(f Facts) Book {
	t := themeTexts[f.Theme]
	if t.title == "" {
		t = themeTexts[Bedtime]
	}
	b := Book{Title: fill(t.title, f, ""), GeneratedBy: "template"}
	add := func(p Page, memory string) {
		b.Pages = append(b.Pages, Page{Text: fill(p.Text, f, memory), Art: p.Art})
	}
	for _, p := range t.open {
		add(p, "")
	}
	for i, m := range f.Memories {
		if i == MaxMemories {
			break
		}
		add(Page{Text: memoryFrames[i], Art: t.memoryArt[i]}, sentence(m))
		if i == 0 {
			add(t.bridge, "")
		}
	}
	for _, p := range t.close {
		add(p, "")
	}
	return b
}
