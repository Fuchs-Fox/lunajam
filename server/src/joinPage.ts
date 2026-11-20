import { formatCode, type ResolveSummary } from '../../plugins/lunajam/src/protocol'

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderJoinPage(summary: ResolveSummary | null, publicOrigin: string): string {
  if (!summary) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LunaJam — Room not found</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0c;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif}
.panel{width:100%;max-width:420px;padding:24px;border-radius:12px;background:#141519;border:1px solid rgba(255,255,255,0.1)}
h1{margin:0 0 8px;font-size:18px;font-weight:600}
p{margin:0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.64)}
</style>
</head>
<body>
<main class="panel">
<h1>Session ended or not found</h1>
<p>This Jam link is no longer active. Ask the host for a fresh link or room code.</p>
</main>
</body>
</html>`
  }

  const formattedCode = formatCode(summary.code)
  const hostTitle = `${summary.hostName}'s Jam`
  const trackText = summary.track ? `${summary.track.title}${summary.track.artist ? ` — ${summary.track.artist}` : ''}` : 'Waiting for track'
  const coverHtml = summary.track?.coverUrl
    ? `<img class="cover" src="${escapeHtml(summary.track.coverUrl)}" alt="" width="64" height="64">`
    : `<div class="cover cover-empty" aria-hidden="true"></div>`
  const deepLink = `tidaluna://lunajam/join?code=${encodeURIComponent(summary.code)}&server=${encodeURIComponent(publicOrigin)}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(hostTitle)} — LunaJam</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0c;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif}
.panel{width:100%;max-width:440px;padding:24px;border-radius:12px;background:#141519;border:1px solid rgba(255,255,255,0.1)}
.head{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.cover{width:64px;height:64px;border-radius:6px;object-fit:cover;background:#1d1f26;flex-shrink:0}
.meta{min-width:0}
h1{margin:0 0 4px;font-size:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.live{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-variant-numeric:tabular-nums;color:#2ee6d6}
.dot{width:8px;height:8px;border-radius:9999px;background:#2ee6d6}
.actions{display:flex;gap:8px;margin-bottom:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:transform 140ms cubic-bezier(0.16,1,0.3,1),background-color 140ms ease}
.btn:active{transform:scale(0.97)}
.btn-primary{background:#ffffff;color:#0a0a0c;flex:1}
.btn-secondary{background:#1d1f26;color:#ffffff;border-color:rgba(255,255,255,0.12)}
.status{margin:0;font-size:12px;color:rgba(255,255,255,0.52);min-height:18px}
</style>
</head>
<body>
<main class="panel">
<div class="head">
${coverHtml}
<div class="meta">
<h1>${escapeHtml(hostTitle)}</h1>
<p class="track">${escapeHtml(trackText)}</p>
<div class="live"><span class="dot"></span><span>${summary.participantCount} of ${summary.maxParticipants} listening · ${escapeHtml(formattedCode)}</span></div>
</div>
</div>
<div class="actions">
<a class="btn btn-primary" id="open-btn" href="${escapeHtml(deepLink)}">Open in TIDAL</a>
<button class="btn btn-secondary" id="copy-btn" type="button">Copy code</button>
</div>
<p class="status" id="status-line">Connecting to TidaLuna on this device...</p>
</main>
<script>
(function(){
  var code=${JSON.stringify(summary.code)};
  var formatted=${JSON.stringify(formattedCode)};
  var server=${JSON.stringify(publicOrigin)};
  var deepLink=${JSON.stringify(deepLink)};
  var statusEl=document.getElementById("status-line");
  var copyBtn=document.getElementById("copy-btn");
  copyBtn.addEventListener("click",function(){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(formatted).then(function(){copyBtn.textContent="Copied";setTimeout(function(){copyBtn.textContent="Copy code"},1800)});
    }
  });
  var done=false;
  var ports=[];
  for(var p=24860;p<=24869;p++)ports.push(p);
  var fallbackTimer=setTimeout(function(){
    if(done)return;
    statusEl.textContent="Opening via tidaluna:// link. If TIDAL does not open, copy the code above.";
    window.location.href=deepLink;
  },700);
  ports.forEach(function(port){
    var url="http://127.0.0.1:"+port+"/lunajam-join?code="+encodeURIComponent(code)+"&server="+encodeURIComponent(server);
    fetch(url,{mode:"cors"}).then(function(r){
      if(!r.ok)throw new Error("bad status");
      return r.json();
    }).then(function(body){
      if(!done&&body&&body.ok){
        done=true;
        clearTimeout(fallbackTimer);
        statusEl.textContent="Joined Jam in TIDAL. You can close this tab.";
      }
    }).catch(function(){});
  });
})();
</script>
</body>
</html>`
}
