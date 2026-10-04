/* ==========================================================
   WORKS
   作品データは data/works.json から読み込みます。
   作品やカードの追加・編集は、編集ソフト（「編集ソフトを開く.bat」）から行ってください。

   data/works.json の形式
   - title    : メインタイトル（\n で改行）
   - card     : カードに表示する文字（\n で改行、4 行まで）
   - category / color : カード下部のカテゴリ名と色
   - year     : カード下部の年
   - credit   : クレジット（\n で改行）
   - images   : 背景画像の配列。{ src: 画像のパス, scrim: 文字を読みやすくする暗幕の濃さ 0〜1 }
   ========================================================== */
let WORKS = [];

const bgStage = document.getElementById("works-bgs");
const scrimEl = document.getElementById("works-scrim");
const titleEl = document.getElementById("work-title");
const creditEl = document.getElementById("work-credit");
const pagerEls = [document.getElementById("work-pager")];
const cardsEl = document.getElementById("work-cards");

let current = 0;
let currentImage = 0;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SLIDE_MS = 900; // CSS の .works__bg の transition と合わせる
let bgRequest = 0;

/* 背景：上下にスライドして切り替え
   dir =  1 : 次へ（新しい画像が下から入り、今の画像は上へ抜ける）
   dir = -1 : 前へ（新しい画像が上から入り、今の画像は下へ抜ける）
   dir =  0 : アニメーションなし */
/* 画像を背景レイヤーにセット（縦は画面に収め、左右の余白は同じ画像のぼかしで埋める：CSS 側） */
function applyImage(layer, src) {
  // CSS 変数内の url() は CSS ファイル基準で解決されるため、絶対 URL にして渡す
  layer.style.setProperty("--img", `url("${new URL(src, location.href).href}")`);
}

function setBackground(image, dir = 1) {
  const id = ++bgRequest;
  const src = image.src;
  scrimEl.style.setProperty("--scrim", image.scrim ?? 0);
  const img = new Image();
  const loaded = new Promise((resolve) => {
    img.onload = img.onerror = resolve;
  });
  img.src = src;

  loaded.then(() => {
    if (id !== bgRequest) return; // 連続で切り替えた場合は最後のものだけ反映

    if (!dir || reduceMotion) {
      bgStage.replaceChildren(bgStage.lastElementChild);
      applyImage(bgStage.lastElementChild, src);
      return;
    }

    const outgoing = [...bgStage.children];
    const next = document.createElement("div");
    next.className = "works__bg";
    applyImage(next, src);
    next.style.transform = `translateY(${dir * 100}%)`;
    bgStage.appendChild(next);
    next.getBoundingClientRect(); // 初期位置を確定させてからアニメーション開始

    next.style.transform = "translateY(0)";
    outgoing.forEach((layer) => {
      layer.style.transform = `translateY(${-dir * 100}%)`;
    });
    setTimeout(() => outgoing.forEach((layer) => layer.remove()), SLIDE_MS);
  });
}

/* テキスト：ランダムな文字に化けながら新しいテキストに切り替わる */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-=/<>_[]{}";
const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

function scrambleText(el, to, duration = 700) {
  cancelAnimationFrame(el._scramble);
  if (reduceMotion) {
    el.textContent = to;
    return;
  }
  const from = el.textContent;
  const length = Math.max(from.length, to.length);
  // 1 文字ごとに「化け始め」と「確定」のタイミングをずらす（左から順に確定していく）
  const chars = Array.from({ length }, (_, i) => {
    const start = Math.random() * duration * 0.3;
    const end = start + duration * 0.3 + (i / length) * duration * 0.4 + Math.random() * duration * 0.1;
    return { from: from[i] ?? "", to: to[i] ?? "", start, end, glyph: randomGlyph() };
  });
  const t0 = performance.now();

  const frame = (now) => {
    const t = now - t0;
    let out = "";
    let done = true;
    for (const c of chars) {
      if (t >= c.end) {
        out += c.to;
      } else {
        done = false;
        if (c.to === "\n" || c.to === " ") {
          out += c.to; // 改行・空白は崩さず、レイアウトのガタつきを防ぐ
        } else if (t >= c.start) {
          if (Math.random() < 0.3) c.glyph = randomGlyph();
          out += c.glyph;
        } else {
          out += c.from === "\n" ? c.glyph : c.from;
        }
      }
    }
    el.textContent = out;
    if (!done) el._scramble = requestAnimationFrame(frame);
  };
  el._scramble = requestAnimationFrame(frame);
}

/* ドット（画像の切り替え） */
function renderPager(work) {
  pagerEls.forEach((pager) => {
    pager.innerHTML = "";
    work.images.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "pager__dot" + (i === currentImage ? " is-active" : "");
      dot.setAttribute("aria-label", `画像 ${i + 1}`);
      dot.addEventListener("click", () => showImage(i));
      pager.appendChild(dot);
    });
  });
}

function showImage(i) {
  if (!WORKS.length) return;
  const count = WORKS[current].images.length;
  if (i < 0 || i >= count || i === currentImage) return;
  const work = WORKS[current];
  const dir = i > currentImage ? 1 : -1;
  currentImage = i;
  setBackground(work.images[i], dir);
  pagerEls.forEach((pager) => {
    [...pager.children].forEach((dot, n) => dot.classList.toggle("is-active", n === i));
  });
}

/* dir: 1 = 次へ / -1 = 前へ / 0 = アニメーションなし */
function showWork(index, dir = 1) {
  if (!WORKS.length) return;
  const animate = dir !== 0;
  current = (index + WORKS.length) % WORKS.length;
  currentImage = 0;
  const work = WORKS[current];
  const credit = work.credit ? `// credit\n\n${work.credit}` : "";

  if (animate) {
    scrambleText(titleEl, work.title);
    scrambleText(creditEl, credit, 900);
  } else {
    titleEl.textContent = work.title;
    creditEl.textContent = credit;
  }
  if (work.images.length) setBackground(work.images[0], dir);
  renderPager(work);

  [...cardsEl.children].forEach((card, n) => {
    card.classList.toggle("is-active", n === current);
    card.setAttribute("aria-current", n === current ? "true" : "false");
  });
  cardsEl.children[current].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function renderCards() {
  WORKS.forEach((work, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.style.setProperty("--accent", work.color);
    card.setAttribute("aria-label", `${String(i + 1).padStart(2, "0")} ${work.title.replace(/\n/g, " ")}`);
    card.innerHTML = `
      <span class="card__no">No.</span>
      <span class="card__num">${String(i + 1).padStart(2, "0")}</span>
      <span class="card__title"></span>
      <span class="card__cat"></span>
      <span class="card__year"></span>`;
    card.querySelector(".card__title").textContent = work.card;
    card.querySelector(".card__cat").textContent = work.category;
    card.querySelector(".card__year").textContent = work.year;
    card.addEventListener("click", () => {
      if (i !== current) showWork(i, i > current ? 1 : -1);
    });
    cardsEl.appendChild(card);
  });
}

/* カード列の端のフェード
   幅 = min(最大幅, 端までの残り距離)。スクロールに直接連動するので遅れがなく、端に着くと 0 になる */
function updateFade() {
  // 画面の拡大率によって scrollLeft が端ぴったりにならないことがあるため、数 px の誤差を許容する
  const EDGE = 2;
  const size = parseFloat(getComputedStyle(cardsEl).getPropertyValue("--fade-size")) || 120;
  const max = cardsEl.scrollWidth - cardsEl.clientWidth;
  const toLeft = cardsEl.scrollLeft;
  const toRight = max - cardsEl.scrollLeft;
  const fade = (d) => (d <= EDGE ? 0 : Math.min(size, d));
  cardsEl.style.setProperty("--fade-l", `${fade(toLeft)}px`);
  cardsEl.style.setProperty("--fade-r", `${fade(toRight)}px`);
}
cardsEl.addEventListener("scroll", updateFade, { passive: true });
cardsEl.addEventListener("scrollend", updateFade);
window.addEventListener("resize", updateFade);

/* マウスホイール（縦スクロール）でカード列を横に動かす */
let wheelTarget = null;
function animateWheel() {
  const before = cardsEl.scrollLeft;
  const diff = wheelTarget - before;
  // 最低 1px ずつ動かす（小数の移動量がブラウザに丸められて端の手前で止まるのを防ぐ）
  const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.18);
  if (Math.abs(diff) <= 1) {
    cardsEl.scrollLeft = wheelTarget;
  } else {
    cardsEl.scrollLeft = before + step;
  }
  updateFade();
  if (Math.abs(diff) <= 1 || cardsEl.scrollLeft === before) {
    cardsEl.scrollLeft = wheelTarget;
    wheelTarget = null;
    updateFade();
    return;
  }
  requestAnimationFrame(animateWheel);
}
/* 全体表示中のホイール：下へで次の画像、上へで前の画像
   トラックパッドの細かいイベントで連続して切り替わらないよう、一定量たまったら 1 枚進め、
   スライド中は受け付けない */
const WHEEL_STEP = 40;
const WHEEL_LOCK_MS = 700;
let wheelSum = 0;
let wheelLockedUntil = 0;

function wheelImage(delta) {
  const now = performance.now();
  if (now < wheelLockedUntil) return;
  wheelSum += delta;
  if (Math.abs(wheelSum) < WHEEL_STEP) return;
  const before = currentImage;
  showImage(currentImage + Math.sign(wheelSum));
  wheelSum = 0;
  if (currentImage !== before) wheelLockedUntil = now + WHEEL_LOCK_MS;
}

window.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // 横スクロールはそのまま
  e.preventDefault();
  const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  if (worksEl.classList.contains("is-viewing")) {
    wheelImage(delta);
    return;
  }
  const max = cardsEl.scrollWidth - cardsEl.clientWidth;
  const start = wheelTarget === null;
  wheelTarget = Math.max(0, Math.min(max, (wheelTarget ?? cardsEl.scrollLeft) + delta));
  if (start) requestAnimationFrame(animateWheel);
}, { passive: false });

document.getElementById("work-prev").addEventListener("click", () => showWork(current - 1, -1));
document.getElementById("work-next").addEventListener("click", () => showWork(current + 1, 1));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") showWork(current - 1, -1);
  if (e.key === "ArrowRight") showWork(current + 1, 1);
  if (e.key === "ArrowUp") showImage(currentImage - 1);
  if (e.key === "ArrowDown") showImage(currentImage + 1);
  if (e.key === "Escape") setViewing(false);
});

/* 画像の全体表示モード
   背景の空いている所をクリック → 情報を格納して画像だけを表示。もう一度クリック（または Esc）で戻る */
const worksEl = document.querySelector(".works");
const INTERACTIVE = "a, button, .site-header, .works__hero, .works__list, .pager";

function setViewing(on) {
  worksEl.classList.toggle("is-viewing", on);
}

worksEl.addEventListener("click", (e) => {
  if (e.target.closest(".pager")) return; // ドットは全体表示中でも操作できる
  if (worksEl.classList.contains("is-viewing")) {
    setViewing(false);
    return;
  }
  if (e.target.closest(INTERACTIVE)) return;
  setViewing(true);
});

/* 表示（作品データを差し替えて描き直す） */
function render(works, index = 0) {
  WORKS = works;
  cardsEl.innerHTML = "";
  renderCards();
  showWork(Math.min(index, WORKS.length - 1), 0);
  updateFade();
}

/* 編集ソフトのプレビューから、保存前の内容を受け取って表示する */
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "snd-preview") return;
  render(e.data.works, e.data.index ?? 0);
});

// ?work=3 のように指定すると、その作品（1 始まり）を開いた状態で表示
const startIndex = Math.max(0, (parseInt(new URLSearchParams(location.search).get("work"), 10) || 1) - 1);

fetch("data/works.json", { cache: "no-cache" })
  .then((res) => res.json())
  .then((data) => render(data.works || [], startIndex))
  .catch((err) => console.error("作品データを読み込めませんでした", err));