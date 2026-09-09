import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { api, loadImage, drawCover, drawContain } from "../lib";

export default function Kiosk() {
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState(null);
  const [sub, setSub] = useState(null);
  const [stream, setStream] = useState(null);
  const [shots, setShots] = useState([]);
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState("Choose a template.");
  const [countdown, setCountdown] = useState(null);
  const [finalReady, setFinalReady] = useState(false);
  const [printUrl, setPrintUrl] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api("/api/templates")
      .then(data => setTemplates(data.filter(x => x.enabled)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const enabledSubs = useMemo(
    () => (category?.subtemplates || []).filter(x => x.enabled),
    [category]
  );

  async function startCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1440 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 4 / 3 }
        },
        audio: false
      });
      setStream(media);
      setStatus("Camera ready.");
    } catch (e) {
      console.error(e);
      setStatus("Camera permission failed. Allow camera access.");
    }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function runCountdown(seconds) {
    for (let i = seconds; i >= 1; i--) {
      setCountdown(i);
      await wait(1000);
    }
    setCountdown(null);
  }

  function takeShot() {
    const video = videoRef.current;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1440;
    c.height = video.videoHeight || 1080;
    const ctx = c.getContext("2d");
    ctx.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.95);
  }

  async function beginSession() {
    if (!stream || !sub) return;

    const count = Math.max(4, Math.min(6, Number(sub.captureCount || 6)));
    const delay = Number(sub.countdownSeconds || 3);

    setShots([]);
    setSelected([]);
    setFinalReady(false);
    setPrintUrl("");

    for (let i = 0; i < count; i++) {
      setStatus(`Get ready — photo ${i + 1} of ${count}`);
      await runCountdown(delay);
      const shot = takeShot();
      setShots(prev => [...prev, shot]);
      await wait(450);
    }
    setStatus(`Choose ${sub.finalPhotoCount} favorite photo(s).`);
  }

  function toggleSelection(index) {
    setSelected(prev => {
      if (prev.includes(index)) return prev.filter(x => x !== index);
      if (prev.length >= sub.finalPhotoCount) return prev;
      return [...prev, index];
    });
  }

  async function compose() {
    if (!sub || selected.length !== sub.finalPhotoCount) return;

    const canvas = canvasRef.current;
    canvas.width = sub.canvas.width;
    canvas.height = sub.canvas.height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = sub.backgroundColor || "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (sub.background) {
      const bg = await loadImage(sub.background);
      if (bg) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    }

    for (let i = 0; i < selected.length; i++) {
      const img = await loadImage(shots[selected[i]]);
      const slot = sub.slots[i];
      if (sub.fitMode === "cover") {
        drawCover(ctx, img, slot.x, slot.y, slot.width, slot.height);
      } else {
        drawContain(ctx, img, slot.x, slot.y, slot.width, slot.height, sub.slotBackground || "#fff");
      }
    }

    if (sub.overlay) {
      const overlay = await loadImage(sub.overlay);
      if (overlay) ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
    }

    const printId = crypto.randomUUID();
    const printBaseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const publicUrl = `${printBaseUrl.replace(/\/$/, "")}/prints/${printId}.jpg`;
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, publicUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
      color: { dark: "#161616", light: "#ffffff" }
    });
    const qrSize = 220;
    const qrX = canvas.width - qrSize - 55;
    const qrY = canvas.height - qrSize - 55;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28);
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    await api("/api/prints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: printId, dataUrl })
    });

    setPrintUrl(publicUrl);
    setFinalReady(true);
    setStatus("Final print ready.");
  }

  function downloadFinal() {
    const a = document.createElement("a");
    a.download = `photobooth-${Date.now()}.jpg`;
    a.href = canvasRef.current.toDataURL("image/jpeg", 0.95);
    a.click();
  }

  function printFinal() {
    const data = canvasRef.current.toDataURL("image/jpeg", 0.95);
    const w = window.open("", "_blank", "width=850,height=900");
    w.document.write(`
      <html>
      <head>
        <title>Photobooth Print</title>
        <style>
          @page { size: 4in 6in; margin: 0; }
          html,body { margin:0; padding:0; }
          img { display:block; width:4in; height:6in; object-fit:contain; }
        </style>
      </head>
      <body>
        <img src="${data}">
        <script>window.onload=()=>window.print();<\/script>
      </body>
      </html>
    `);
    w.document.close();
  }

  function resetAll() {
    setCategory(null);
    setSub(null);
    setShots([]);
    setSelected([]);
    setFinalReady(false);
    setPrintUrl("");
    setStatus("Choose a template.");
  }

  const frameRatio = sub?.slots?.[0]
    ? `${sub.slots[0].width} / ${sub.slots[0].height}`
    : "3 / 4";

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">SELF PHOTO KIOSK</div>
          <h1>Photobooth</h1>
        </div>
        <Link className="ghostButton" to="/admin">Owner</Link>
      </header>

      <main>
        <section className="section">
          <div className="stepTitle">
            <span>01</span>
            <div>
              <h2>Choose a template</h2>
              <p>Select a theme or collection.</p>
            </div>
          </div>

          <div className="tiles">
            {templates.map(t => (
              <button
                key={t.id}
                className={`tile ${category?.id === t.id ? "active" : ""}`}
                onClick={() => {
                  setCategory(t);
                  setSub(null);
                  setShots([]);
                  setSelected([]);
                  setFinalReady(false);
                  setStatus(`Choose a design from ${t.name}.`);
                }}
              >
                <div className="tileImage">
                  {t.coverImage ? <img src={t.coverImage} alt="" /> : <div className="placeholder">{t.name}</div>}
                </div>
                <strong>{t.name}</strong>
              </button>
            ))}
          </div>
        </section>

        {category && (
          <section className="section">
            <div className="stepTitle">
              <span>02</span>
              <div>
                <h2>Choose a design</h2>
                <p>Each design can have its own frame and background.</p>
              </div>
            </div>

            <div className="tiles">
              {enabledSubs.map(s => (
                <button
                  key={s.id}
                  className={`tile ${sub?.id === s.id ? "active" : ""}`}
                  onClick={() => {
                    setSub(s);
                    setShots([]);
                    setSelected([]);
                    setFinalReady(false);
                    setStatus(`${s.captureCount} shots. Choose ${s.finalPhotoCount} favorite(s) after.`);
                  }}
                >
                  <div className="tileImage">
                    {s.background ? <img src={s.background} alt="" /> : <div className="placeholder">{s.name}</div>}
                  </div>
                  <strong>{s.name}</strong>
                  <small>{s.captureCount} shots → {s.finalPhotoCount} final</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {sub && (
          <section className="section">
            <div className="stepTitle">
              <span>03</span>
              <div>
                <h2>Take your photos</h2>
                <p>{status}</p>
              </div>
            </div>

            <div className="cameraShell">
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="safeFrame" style={{ aspectRatio: frameRatio }} />
              {countdown !== null && <div className="countdown">{countdown}</div>}
            </div>

            <div className="actions">
              <button onClick={startCamera}>Start Camera</button>
              <button className="primary" disabled={!stream} onClick={beginSession}>
                Start {sub.captureCount}-Shot Session
              </button>
            </div>
          </section>
        )}

        {shots.length > 0 && (
          <section className="section">
            <div className="stepTitle">
              <span>04</span>
              <div>
                <h2>Choose your favorites</h2>
                <p>Select exactly {sub.finalPhotoCount}. Selection order becomes print order.</p>
              </div>
            </div>

            <div className="shots">
              {shots.map((src, i) => {
                const order = selected.indexOf(i);
                return (
                  <button
                    className={`shot ${order >= 0 ? "selected" : ""}`}
                    onClick={() => toggleSelection(i)}
                    key={i}
                  >
                    <img src={src} alt={`Shot ${i + 1}`} />
                    <span>Photo {i + 1}</span>
                    {order >= 0 && <b>{order + 1}</b>}
                  </button>
                );
              })}
            </div>

            <div className="actions">
              <button
                className="primary"
                disabled={selected.length !== sub.finalPhotoCount}
                onClick={compose}
              >
                Create Final Print
              </button>
              <button onClick={() => setSelected([])}>Clear Selection</button>
            </div>
          </section>
        )}

        <section className="section">
          <div className="stepTitle">
            <span>05</span>
            <div>
              <h2>Final print</h2>
              <p>4×6 output preview.</p>
            </div>
          </div>

          <div className="canvasWrap">
            <canvas ref={canvasRef} width="1200" height="1800" />
          </div>

          {printUrl && <p className="printLink">Scan the QR code on the print to download the final photo.</p>}

          <div className="actions">
            <button className="primary" disabled={!finalReady} onClick={printFinal}>Print</button>
            <button disabled={!finalReady} onClick={downloadFinal}>Download JPG</button>
            <button onClick={resetAll}>New Session</button>
          </div>
        </section>
      </main>
    </div>
  );
}
