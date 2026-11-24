/* Crown Consulting client upload page.
 * No analytics, no third-party calls except the storage upload itself.
 * The invite token in the URL is only ever sent to our own API over POST. */
(function () {
  'use strict';

  var API = '/api/portal';
  var CSRF_KEY = 'crown_portal_csrf';
  var token = new URLSearchParams(window.location.search).get('r') || '';
  var csrf = sessionStorage.getItem(CSRF_KEY) || '';
  var context = null;
  var queue = [];
  var received = 0;
  var batchTimer = null;

  // Keep the token out of browser history / referrers once we have it.
  if (token && window.history && window.history.replaceState) {
    try { window.history.replaceState({}, '', window.location.pathname); } catch (e) { /* ignore */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  var views = ['loading', 'invalid', 'unavailable', 'request', 'verify', 'upload', 'closed', 'done'];

  function show(name) {
    views.forEach(function (v) { $('view-' + v).hidden = v !== name; });
  }

  function setError(id, msg) {
    var el = $(id);
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (csrf) headers['X-CSRF-Token'] = csrf;
    return fetch(API + '/' + path, {
      method: opts.method || 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: opts.method === 'GET' ? undefined : JSON.stringify(opts.body || {}),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        data.__status = res.status;
        return data;
      });
    });
  }

  function formatBytes(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }

  // ---------------------------------------------------------------------
  // Boot: existing session first, otherwise the link flow.
  // ---------------------------------------------------------------------
  function boot() {
    show('loading');
    api('session', { method: 'GET' }).then(function (data) {
      if (data.__status === 503) return show('unavailable');
      if (data.ok && data.closed) return show('closed');
      if (data.ok && data.context && csrf) {
        context = data.context;
        return enterUpload();
      }
      if (!token) return show('invalid');
      return api('lookup', { body: { token: token } }).then(function (r) {
        if (r.__status === 503) return show('unavailable');
        if (!r.ok) return show('invalid');
        $('email-hint').textContent = r.emailHint;
        $('email-hint-2').textContent = r.emailHint;
        show('request');
      });
    }).catch(function () { show('unavailable'); });
  }

  // ---------------------------------------------------------------------
  // OTP
  // ---------------------------------------------------------------------
  var resendUntil = 0;
  function startResendTimer(seconds) {
    resendUntil = Date.now() + seconds * 1000;
    var btn = $('btn-resend');
    var timer = $('resend-timer');
    btn.disabled = true;
    (function tick() {
      var left = Math.ceil((resendUntil - Date.now()) / 1000);
      if (left <= 0) { btn.disabled = false; timer.textContent = ''; return; }
      timer.textContent = '(available in ' + left + 's)';
      setTimeout(tick, 1000);
    })();
  }

  function sendCode() {
    setError('err-request', '');
    setError('err-verify', '');
    $('btn-send').disabled = true;
    return api('send-code', { body: { token: token } }).then(function (r) {
      $('btn-send').disabled = false;
      if (r.__status === 429) {
        setError('err-request', 'Please wait a minute before requesting another code.');
        setError('err-verify', 'Please wait a minute before requesting another code.');
        return;
      }
      if (!r.ok) {
        setError('err-request', 'We could not send a code right now. Please try again shortly.');
        setError('err-verify', 'We could not send a code right now. Please try again shortly.');
        return;
      }
      show('verify');
      $('code').value = '';
      $('code').focus();
      startResendTimer(60);
    });
  }

  $('form-request').addEventListener('submit', function (e) { e.preventDefault(); sendCode(); });
  $('btn-resend').addEventListener('click', function () { sendCode(); });
  $('btn-have-code').addEventListener('click', function () {
    setError('err-verify', '');
    show('verify');
    $('code').value = '';
    $('code').focus();
  });

  $('form-verify').addEventListener('submit', function (e) {
    e.preventDefault();
    setError('err-verify', '');
    var code = $('code').value.replace(/\D/g, '');
    if (code.length !== 6) { setError('err-verify', 'Enter the 6-digit code from your email.'); return; }
    $('btn-verify').disabled = true;
    api('verify-code', { body: { token: token, code: code } }).then(function (r) {
      $('btn-verify').disabled = false;
      if (!r.ok) {
        setError('err-verify', r.__status === 429
          ? 'Too many attempts. Request a new code and try again.'
          : 'That code is not valid. Check the digits, or request a new code.');
        return;
      }
      csrf = r.csrf;
      sessionStorage.setItem(CSRF_KEY, csrf);
      context = r.context;
      enterUpload();
    });
  });

  // ---------------------------------------------------------------------
  // Upload view
  // ---------------------------------------------------------------------
  function renderChecklist(list) {
    var wrap = $('checklist');
    wrap.innerHTML = '';
    if (!list || !list.length) { $('checklist-wrap').hidden = true; return; }
    $('checklist-wrap').hidden = false;
    list.forEach(function (group) {
      if (group.group) {
        var h = document.createElement('h3');
        h.textContent = group.group;
        wrap.appendChild(h);
      }
      var ul = document.createElement('ul');
      (group.items || []).forEach(function (it) {
        var li = document.createElement('li');
        li.textContent = it.label;
        if (it.note) {
          var s = document.createElement('small');
          s.textContent = it.note;
          li.appendChild(s);
        }
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    });
  }

  function enterUpload() {
    $('ctx-reference').textContent = 'Request ' + context.reference;
    $('ctx-org').textContent = context.orgName;
    $('ctx-purpose').textContent = context.purpose;
    $('ctx-instructions').textContent = context.instructions || '';
    $('ctx-instructions').hidden = !context.instructions;
    renderChecklist(context.checklist);
    var lim = context.limits;
    $('limits-line').textContent = lim.allowedTypes.map(function (t) { return t.toUpperCase(); }).join(', ') +
      ' · up to ' + formatBytes(lim.maxFileBytes) + ' per file · ' + formatBytes(lim.maxTotalBytes) + ' total';
    show('upload');
  }

  var dz = $('dropzone');
  var input = $('file-input');
  dz.addEventListener('click', function () { input.click(); });
  dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-over'); });
  });
  dz.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });

  function addFiles(fileList) {
    setError('err-upload', '');
    Array.prototype.forEach.call(fileList, function (file) {
      var item = { file: file, status: 'queued', progress: 0, fileId: null, error: '', el: null };
      queue.push(item);
      renderItem(item);
      startUpload(item);
    });
  }

  function renderItem(item) {
    if (!item.el) {
      item.el = document.createElement('li');
      item.el.className = 'portal-file';
      $('file-list').appendChild(item.el);
    }
    var statusText = {
      queued: 'Waiting', granting: 'Preparing', uploading: 'Uploading ' + Math.round(item.progress) + '%',
      finalizing: 'Confirming', received: 'Received', failed: 'Failed', rejected: 'Not accepted', closed: 'Request closed',
    }[item.status] || item.status;
    var cls = item.status === 'received' ? 'is-ok' : (item.status === 'failed' || item.status === 'rejected' || item.status === 'closed' ? 'is-err' : '');
    var html = '<span class="portal-file-name"></span>' +
      '<span class="portal-file-status ' + cls + '">' + statusText + '</span>' +
      '<span class="portal-file-meta">' + formatBytes(item.file.size) + '</span>';
    if (item.status === 'uploading' || item.status === 'finalizing' || item.status === 'granting') {
      html += '<span class="portal-file-bar"><span style="width:' + item.progress + '%"></span></span>';
    }
    if (item.error) html += '<span class="portal-file-error"></span>';
    if (item.status === 'failed') html += '<span class="portal-file-actions"><button type="button" class="portal-link" data-retry>Retry</button></span>';
    item.el.innerHTML = html;
    item.el.querySelector('.portal-file-name').textContent = item.file.name;
    if (item.error) item.el.querySelector('.portal-file-error').textContent = item.error;
    var retry = item.el.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', function () { item.error = ''; item.progress = 0; startUpload(item); });
  }

  function markClosed() {
    queue.forEach(function (it) {
      if (it.status !== 'received') { it.status = 'closed'; it.upload && it.upload.abort && it.upload.abort(); renderItem(it); }
    });
    show('closed');
  }

  function startUpload(item) {
    item.status = 'granting';
    renderItem(item);
    api('grant', { body: { filename: item.file.name, size: item.file.size, mime: item.file.type } }).then(function (g) {
      if (g.closed) return markClosed();
      if (g.__status === 401) { sessionStorage.removeItem(CSRF_KEY); return boot(); }
      if (!g.ok) {
        item.status = g.__status === 422 ? 'rejected' : 'failed';
        item.error = g.error || 'Could not start this upload.';
        return renderItem(item);
      }
      item.fileId = g.fileId;
      item.status = 'uploading';
      renderItem(item);
      var done = function () { finalize(item); };
      var fail = function (err) {
        item.status = 'failed';
        item.error = 'The upload was interrupted. Check your connection and retry.';
        if (err && /409/.test(String(err))) item.error = 'This upload was already completed or its slot was used. Add the file again.';
        renderItem(item);
      };
      // Resumable uploads only when the server offers them and the library loaded;
      // otherwise a single signed PUT with progress. If the resumable path
      // fails before any bytes are accepted, fall back to the PUT once.
      if (g.upload.tus && window.tus && window.tus.isSupported) {
        uploadTus(item, g.upload.tus, done, function () { uploadPut(item, g.upload.put, done, fail); });
      } else {
        uploadPut(item, g.upload.put, done, fail);
      }
    }).catch(function () {
      item.status = 'failed';
      item.error = 'Network error. Please retry.';
      renderItem(item);
    });
  }

  function uploadTus(item, cfg, done, fail) {
    var upload = new window.tus.Upload(item.file, {
      endpoint: cfg.endpoint,
      headers: cfg.headers,
      metadata: cfg.metadata,
      chunkSize: cfg.chunkSize,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 2000, 5000, 10000],
      onProgress: function (sent, total) {
        item.progress = total ? (sent / total) * 100 : 0;
        renderItem(item);
      },
      onError: function (err) { fail(err); },
      onSuccess: function () { item.progress = 100; renderItem(item); done(); },
    });
    item.upload = upload;
    upload.start();
  }

  function uploadPut(item, cfg, done, fail) {
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', cfg.url, true);
    xhr.setRequestHeader('Content-Type', cfg.contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) { item.progress = (e.loaded / e.total) * 100; renderItem(item); }
    };
    xhr.onload = function () { if (xhr.status >= 200 && xhr.status < 300) done(); else fail(xhr.status); };
    xhr.onerror = function () { fail('network'); };
    item.upload = { abort: function () { xhr.abort(); } };
    xhr.send(item.file);
  }

  function finalize(item) {
    item.status = 'finalizing';
    renderItem(item);
    api('finalize', { body: { fileId: item.fileId } }).then(function (r) {
      if (r.closed) return markClosed();
      if (r.ok && r.status === 'received') {
        item.status = 'received';
        received += 1;
        renderItem(item);
        updateSummary();
        scheduleBatchDone();
        return;
      }
      if (r.status === 'missing') {
        item.status = 'failed';
        item.error = 'The server did not receive the whole file. Please retry.';
      } else if (r.status === 'rejected' || r.__status === 422) {
        item.status = 'rejected';
        item.error = r.error || 'This file was not accepted.';
      } else {
        item.status = 'failed';
        item.error = r.error || 'Could not confirm the upload. Please retry.';
      }
      renderItem(item);
    }).catch(function () {
      item.status = 'failed';
      item.error = 'Network error while confirming. Please retry.';
      renderItem(item);
    });
  }

  function updateSummary() {
    $('summary').hidden = received === 0;
    $('summary-line').textContent = received + (received === 1 ? ' file has' : ' files have') + ' been received this session and ' +
      (received === 1 ? 'is' : 'are') + ' pending review.';
  }

  function scheduleBatchDone() {
    clearTimeout(batchTimer);
    batchTimer = setTimeout(function () {
      var busy = queue.some(function (it) { return ['queued', 'granting', 'uploading', 'finalizing'].indexOf(it.status) !== -1; });
      if (busy) return scheduleBatchDone();
      api('batch-done');
    }, 4000);
  }

  $('btn-logout').addEventListener('click', function () {
    clearTimeout(batchTimer);
    var finish = function () {
      sessionStorage.removeItem(CSRF_KEY);
      csrf = '';
      $('done-line').textContent = received
        ? received + (received === 1 ? ' file was' : ' files were') + ' received and will be reviewed by Crown Consulting.'
        : 'No files were sent this session.';
      show('done');
    };
    api('batch-done').then(function () { return api('logout'); }).then(finish, finish);
  });

  window.addEventListener('beforeunload', function () {
    var busy = queue.some(function (it) { return ['granting', 'uploading', 'finalizing'].indexOf(it.status) !== -1; });
    if (busy) { return 'Uploads are still in progress.'; }
  });

  boot();
})();
