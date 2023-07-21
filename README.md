<img src="https://kekse.biz/php/count.php?override=github:noto-emoji-animation&text=`noto-emoji-animation`" />

# Animated Emojis by Google
=> [Google: The hub for everything animated emoji!](https://googlefonts.github.io/noto-emoji-animation/)

This was a requested feature: as Google wasn't willing to allow users to mass download all the emojis at once,
in just one package.. you had to scroll through the list, select your emojis and then decide which one of three
image types (supported: **GIF**, **WebP** and **Lottie** (.json)).

But I didn't want to manually download them, I just wanted my own copy (for template/pre-precessor replacements),
so I hacked up a bit into the sources and quickly found everything necessary for this.

The mass download is really fast, as Google really wants users to request any icon every time on demand! :)~

### Download
[Here's the link for this **`kekse.emoji.js`**](js/emoji.js) (v**1.4.0**)!

![Screenshot](docs/preview.png)

## **`.json`** Output
Example `.json` output here:
* [`emoji.json`](json/emoji.json)
* [`emoji.index.json`](json/emoji.index.json)
* [`emoji.ref.json`](json/emoji.ref.json)

## Features
For this moment I recommend you to **read the fucking source** for yourself. I'm going to explain it **l8rs**, j4u!

### News
* Fixed some less errors (but didn't update the [Preview Screenshot](docs/preview.png)..);
* **Additive** downloading: Now checking if a file already exists, then omitting it's download!
* Tiny changes in the format of the resulting `.json` outputs, and now with a **third** JSON output file.
* Tiny changes, too.
* And an [Emoji **PHP** Script](#php) has began.. but not yet finished.

### Yet to come (TODO)
* Incremental download by checking `Content-Length` header, to update outdated files, too!
* `getopt.js` ('instead' of constants on top of file)

## Configuration
Located on (more/less) the top of this **[`kekse.emoji.js`](js/emoji.js)** script..

> **Note**
> My own **`getopt.js`** is _TODO_! ;)~

## **PHP**
Just made a [**PHP** script **`emoji.php`**](php/emoji.php) for direct emoji requests via emoji tags (like `:smile:`, etc.).
_These_ ones are really **on demand**, directly from the Google servers.

Just call this script with a GET query like **`?tag=:smile:&type=webp`**. :)~

Inter alia for this the `emoji.ref.json` was meant to be there, as it indexes all tags and names, and refers to the
real address on the Google servers (whereas there are all three file formats to select).

## Copyright and License
The Copyright is [(c) Sebastian Kucharczyk](COPYRIGHT.txt),
and it's licensed under the [MIT](LICENSE.txt) (also known as 'X' or 'X11' license).

