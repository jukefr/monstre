function main() {
  const canvas = document.querySelector("#glCanvas");
  const ctx = canvas.getContext("2d");

  if (ctx === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it.",
    );
    return;
  }

  function luminance(r, g, b) {
    var a = [r, g, b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }
  function contrast(rgb1, rgb2) {
    var lum1 = luminance(rgb1[0], rgb1[1], rgb1[2]);
    var lum2 = luminance(rgb2[0], rgb2[1], rgb2[2]);
    var brightest = Math.max(lum1, lum2);
    var darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : null;
  }

  window.monstre_convert = async () => {
    const words = document
      .getElementById("emojis")
      .value.split("\n")
      .filter((v) => v !== "");

    const api_key = document.getElementById("api_key").value;

    const emojis = words.map((w) =>
      /\p{Extended_Pictographic}/u.test(w)
        ? // dont worry about it im tired
          // TODO: make better tho
          { most_similar: [{ emoji: w }] }
        : fetch("https://api.t3chflicks.org./emoji-search/recommendations", {
            headers: {
              accept: "*/*",
              "accept-language": "en-US,en;q=0.9",
              "cache-control": "no-cache",
              "content-type": "application/json",
              pragma: "no-cache",
              "sec-ch-ua": '" Not A;Brand";v="99", "Chromium";v="96"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Linux"',
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "cross-site",
            },
            body: `{\"key\":\"${api_key}\",\"search\":\"${w}\",\"quantity\":1}`,
            method: "POST",
            mode: "cors",
            credentials: "omit",
          }).then((response) => response.json()),
    );

    const actualemojis = (await Promise.all(emojis))
      .map((e) => e?.most_similar[0]?.emoji)
      .map((e, i) => (!e ? words[i] : e))
      .join("\n");

    document.getElementById("emojis").value = actualemojis;
  };

  window.monstre_draw = (backgrounds, word, wordindex) => {
    canvas.width = document.getElementById("icon_size").value;
    canvas.height = document.getElementById("icon_size").value;

    // reset background on ever draw so we arent biased for contrasting thingy
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // render emoji without bg (or with white bg) and average every 10px color
    const font = `${document.getElementById("emoji_size").value}px serif`;
    ctx.font = font;
    const fontSize = document.getElementById("emoji_size").value;
    const { width: textWidth } = ctx.measureText(word);

    ctx.fillText(
      word,
      canvas.width / 2 - textWidth / 2,
      canvas.height / 2 + fontSize / 2,
    );

    // sample 900 points should be enough
    // should also work on lower scales i guess it would just round up the nearest pixels
    // and like just duplicate the same values over and over
    let points = [];
    for (let x = 0; x < canvas.width / 30; x++) {
      for (let y = 0; y < canvas.width / 30; y++) {
        points.push(
          ctx.getImageData(
            (x * canvas.width) / 30,
            (y * canvas.width) / 30,
            1,
            1,
          ).data,
        );
      }
    }
    points = points.filter(
      ([pr, pg, pb, pa]) => pr !== 0 && pg !== 0 && pb !== 0 && pa !== 0,
    );
    const totalPoints = points.length;
    const totalPointsValues = points.reduce(
      ([r, g, b], [cr, cg, cb]) => {
        r += cr;
        g += cg;
        b += cb;
        return [r, g, b];
      },
      [0, 0, 0],
    );
    const pointsAverage = [
      totalPointsValues[0] / totalPoints,
      totalPointsValues[1] / totalPoints,
      totalPointsValues[2] / totalPoints,
    ];

    // give to that to contrast algo
    const contrastV = backgrounds
      .map((bg, index) => ({
        contrast: contrast(pointsAverage, hexToRgb(bg)),
        index,
      }))
      .filter(
        (v) =>
          v.contrast >
          Number.parseFloat(document.getElementById("contrast_ratio").value),
      );

    const randomElement =
      contrastV[Math.floor(Math.random() * contrastV.length)];
    ctx.fillStyle = backgrounds[randomElement.index];

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillText(
      word,
      canvas.width / 2 - textWidth / 2,
      canvas.height / 2 + fontSize / 2.7, // i have no clue why this needs to be... but it does... i think...
      // maybe its even only a linux thing or only a me setup thing, who nose, good luck
      // WARN: i guess if you looking for something fucky this might be it
    );

    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => {
        resolve({
          blob,
          filename: `icon-${wordindex}-${word}-${canvas.width}x${canvas.height}.png`,
        });
      }),
    );
  };

  window.monstre_save = async () => {
    const backgrounds = document
      .getElementById("background_colors")
      .value.split("\n")
      .filter((v) => v !== "");
    const words = document
      .getElementById("emojis")
      .value.split("\n")
      .filter((v) => v !== "")
      .filter((v) => /\p{Extended_Pictographic}/u.test(v));
    const files = words.map((w, idx) =>
      window.monstre_draw(backgrounds, w, idx),
    );

    const awaitened = await Promise.all(files);
    const zip = awaitened.reduce(
      (z, { blob, filename }) => z.file(filename, blob),
      new JSZip(),
    );
    return zip.generateAsync({ type: "blob" }).then(function (content) {
      return saveAs(content, "icons.zip");
    });
  };

  // // proprietary nasa code
  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
  });
}

window.onload = main;
