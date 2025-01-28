let num_tracks = 1;

const toc_header = `CD_DA

// Generated with mktoc (https://techtricity.net/projects/mktoc)

`;

function generate_global_cd_text(album_name, album_artist) {
	return `CD_TEXT {
	&emsp;LANGUAGE_MAP {
	&emsp;	&emsp;0 : EN
	&emsp;}

	&emsp;LANGUAGE 0 {
	&emsp;	&emsp;TITLE "${album_name}"
	&emsp;	&emsp;PERFORMER "${album_artist}"
	&emsp;}
}
`
}

function generate_track(track_number, track_name, track_artist) {
	return `// Track ${track_number}: ${track_name} - ${track_artist}
TRACK AUDIO
CD_TEXT {
	&emsp;LANGUAGE 0 {
	&emsp;	&emsp;TITLE "${track_name}"
	&emsp;	&emsp;PERFORMER "${track_artist}"
	&emsp;}
}
FILE "${track_number}.wav" 0

`
}

function generated_string_to_element(str) {
	let output = document.createElement("div");
	output.id = "output";
	output.className = "output";

	for (line of str.split("\n")) {
		output.append(document.createElement("div")); // CSS line counter
		let div = document.createElement("div");
		div.innerHTML = line;
		output.append(div);
	}

	return output;
}

async function mb_get_release_info(mbid) {
	let url = new URL(mbid, "https://musicbrainz.org/ws/2/release/");
	url.search = "inc=recordings+artist-credits"; // get recordings and artists
	let response = await fetch(url, {
		headers: {
			"Accept": "application/json",
			"User-Agent": "mktoc/1.0.0 (https://techtricity.net/projects/mktoc)"
		}
	});
	if (!response.ok) {
		return { "httpstatus": response.status, ... await response.json()};
	}
	return await response.json();
}

function mb_join_artists(artist_credit) {
	let ret = ""
	for (i of artist_credit) {
		ret += i.name + i.joinphrase;
	}
	return ret;
}

document.addEventListener("DOMContentLoaded", _ => {
	const tracks = document.getElementById("tracks");
	const mb_import = document.getElementById("mb-import");
	const plus = document.getElementById("plus");
	const minus = document.getElementById("minus");
	const generate = document.getElementById("generate");
	const messages = document.getElementById("messages");
	const copy = document.getElementById("copy");
	const download = document.getElementById("download");

	function write_message(str) {
		let div = document.createElement("div");
		div.innerText = str;
		messages.append(div);
	}

	function clear_messages() {
		messages.innerHTML = "";
	}

	function add_track() {
		// add track field
		num_tracks++;

		let li = document.createElement("li");
		let track_name = document.createElement("input");
		track_name.placeholder = "track name";
		track_name.id = `track${num_tracks}-name`;
		li.append(track_name);

		li.append(" - ");

		let track_artist = document.createElement("input");
		track_artist.placeholder = "artist";
		track_artist.id = `track${num_tracks}-artist`;
		// Carry over the value from the last track
		track_artist.value =
			document.getElementById(`track${num_tracks - 1}-artist`).value;
		li.append(track_artist);

		tracks.append(li)
		track_name.focus();

		minus.removeAttribute("disabled");
		if (num_tracks == 99) // Did you know CDs can only store 99 tracks?
			plus.setAttribute("disabled", "");
	}

	function remove_track() {
		document.getElementById(`track${num_tracks}-name`).parentNode.remove();

		num_tracks--;

		plus.removeAttribute("disabled");
		if (num_tracks == 0)
			minus.setAttribute("disabled", "");
	}

	function generate_toc() {
		clear_messages();
		let output = toc_header;
		let album_name = document.getElementById("album-name").value;
		let album_artist = document.getElementById("album-artist").value;
		if (album_name == "") {
			write_message("Warning: album has no name");
		}
		if (album_artist == "") {
			write_message("Warning: album has no artist");
		}
		output += generate_global_cd_text(album_name, album_artist);
		if (num_tracks == 0) {
			output = "// No tracks? What did you expect?";
		}
		for (let i = 1; i <= num_tracks; i++) {
			let name = document.getElementById(`track${i}-name`).value;
			let artist = document.getElementById(`track${i}-artist`).value;
			if (name == "") {
				write_message(`Warning: track ${i} has no name`);
			}
			if (artist == "") {
				write_message(`Warning: track ${i} has no artist`);
			}
			output += generate_track(i, name, artist);
		}
		document.getElementById("output").replaceWith(generated_string_to_element(output));
	}

	function musicbrainz_import() {
		mb_import.setAttribute("disabled", "");
		clear_messages();
		let mbid = document.getElementById("mbid").value;
		const uuid_regex = /[a-z0-9]{8}-(?:[a-z0-9]{4}-){3}[a-z0-9]{12}/
		try {
			mbid = mbid.match(uuid_regex)[0];
		} catch(e) {
			if (e instanceof TypeError) {
				write_message("Invalid MBID, input a release MBID or a URL to a release");
			}
			return;
		}
		write_message(`Importing release ${mbid}...`)
		mb_get_release_info(mbid).then(resp => {
			if (resp.httpstatus) {
				write_message(`Import failed: got code ${resp.httpstatus}`);
				if (resp.error) {
					write_message(`Import failed: got message "${resp.error}"`);
				}
				if (resp.httpstatus == 404)
					write_message("Import failed: Make sure you copied the MBID correctly");
				mb_import.removeAttribute("disabled");
				return;
			}
			write_message(`Importing: Got title ${resp.title}`);
			document.getElementById("album-name").value = resp.title;
			document.getElementById("album-artist").value =
				mb_join_artists(resp["artist-credit"]);
			let media = resp.media[0];
			if (resp.media.length > 1) {
				write_message(`Importing: ${resp.media.length} pieces of media detected`);
				for (let i = 0; i < resp.media.length; i++) {
					if (resp.media[i].format == "CD") {
						write_message(`Importing: Choosing media #${i + 1}, the first CD`);
					}
				}
			}
			write_message(`Importing: Got ${media["track-count"]} tracks`);
			let track_diff = media["track-count"] - num_tracks;
			while (track_diff != 0) {
				if (track_diff > 0) {
					add_track();
					track_diff--;
				} else {
					remove_track();
					track_diff++;
				}
			}
			for (let i = 0; i < num_tracks; i++) {
				document.getElementById(`track${i + 1}-name`).value =
					media.tracks[i].title;
				document.getElementById(`track${i + 1}-artist`).value
					= mb_join_artists(media.tracks[i]["artist-credit"]);
			}
			mb_import.removeAttribute("disabled");
		});
	}

	function output_to_string() {
		let ret = "";
		let emptyct = 0;
		for (i of document.getElementById("output").children) {
			if (i.innerText == "") {
				if (emptyct == 2) {
					ret += "\n";
				} else {
					emptyct++;
				}
			} else {
				ret += i.innerText + "\n";
				emptyct = 0;
			}
		}
		// remove any em-spaces (U+2003)
		ret = ret.replaceAll(String.fromCodePoint(0x2003), " ");
		// remove last newline
		ret = ret.substring(0, ret.length - 1);
		for (i of ret) {

		}
		return ret;
	}

	function copy_output() {
		// Clipboard API only works in a secure context
		if (!window.isSecureContext) {
			write_message("Copy: not a secure context, please use HTTPS");
			return;
		}
		if (!navigator.clipboard) {
			write_message("Copy: browser does not support Clipboard API");
		}
		navigator.clipboard.writeText(output_to_string());
	}

	function download_output() {
		let str
		try {
			str = btoa(output_to_string());
		} catch (e) {
			if (e instanceof DOMException
				&& e.name == "InvalidCharacterError") {
				write_message("Download: Invalid character in output, cannot download");
			}
		}
		let title = document.getElementById("album-name").value.split(" ")[0];
		if (title == "") {
			title = "album"
		}
		title += ".toc";
		let a = document.createElement("a");
		a.href = `data:text/plain;base64,${str}`;
		a.download = title;
		a.style.visibility = "hidden";
		document.body.append(a);
		a.click();
		a.remove();
	}

	mb_import.addEventListener("click", musicbrainz_import);
	mb_import.removeAttribute("disabled");

	plus.addEventListener("click", add_track);
	plus.removeAttribute("disabled");

	minus.addEventListener("click", remove_track);
	minus.removeAttribute("disabled");

	generate.addEventListener("click", generate_toc);
	generate.removeAttribute("disabled");

	copy.addEventListener("click", copy_output);
	copy.removeAttribute("disabled");

	download.addEventListener("click", download_output);
	download.removeAttribute("disabled");
});

