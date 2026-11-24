/* Crown staff console. Supabase Auth (email + password + TOTP) in the browser;
 * every data call goes to /api/staff with the access token, where MFA (aal2)
 * and the staff allow-list are enforced server-side. */
(function () {
  'use strict';

  var API = '/api/staff';
  var sb = null;
  var me = null;
  var templates = [];
  var requests = [];
  var current = null;

  var $ = function (id) { return document.getElementById(id); };
  var views = ['signin', 'enrol', 'mfa', 'denied', 'console'];
  function show(name) {
    views.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    $('btn-signout').hidden = name === 'signin';
  }
  function setMsg(id, msg) { var el = $(id); el.textContent = msg || ''; el.hidden = !msg; }
  function err(msg) { setMsg('err-console', msg); setMsg('ok-console', ''); }
  function ok(msg) { setMsg('ok-console', msg); setMsg('err-console', ''); }
  function fmtDate(s) { return s ? new Date(s).toLocaleString() : '—'; }
  function fmtBytes(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return (n || 0) + ' B';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------
  function api(path, opts) {
    opts = opts || {};
    return sb.auth.getSession().then(function (r) {
      var token = r.data && r.data.session ? r.data.session.access_token : '';
      return fetch(API + '/' + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { data.__status = res.status; return data; });
    });
  }

  // ------------------------------------------------------------------
  // Auth flow
  // ------------------------------------------------------------------
  function boot() {
    fetch(API + '/config').then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg.supabaseUrl || !cfg.publishableKey) throw new Error('Portal is not configured (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).');
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey);
      window.__portalScanner = cfg.scanner || 'none';
      return sb.auth.getSession();
    }).then(function (r) {
      if (r && r.data && r.data.session) return afterSignIn();
      show('signin');
    }).catch(function (e) {
      show('signin');
      setMsg('err-signin', e.message || 'Could not load the console.');
    });
  }

  $('form-signin').addEventListener('submit', function (e) {
    e.preventDefault();
    setMsg('err-signin', '');
    sb.auth.signInWithPassword({ email: $('si-email').value.trim(), password: $('si-password').value }).then(function (r) {
      if (r.error) { setMsg('err-signin', 'Sign-in failed. Check your email and password.'); return; }
      $('si-password').value = '';
      afterSignIn();
    });
  });

  function afterSignIn() {
    return sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
      var lvl = r.data || {};
      if (lvl.currentLevel === 'aal2') return enterConsole();
      return sb.auth.mfa.listFactors().then(function (f) {
        var totp = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
        if (totp.length) return challenge(totp[0].id);
        return enrol();
      });
    });
  }

  var enrolFactorId = null;
  function enrol() {
    sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Crown portal' }).then(function (r) {
      if (r.error) { show('signin'); setMsg('err-signin', 'Could not start MFA setup: ' + r.error.message); return; }
      enrolFactorId = r.data.id;
      $('enrol-qr').src = r.data.totp.qr_code;
      $('enrol-secret').textContent = r.data.totp.secret;
      show('enrol');
    });
  }
  $('form-enrol').addEventListener('submit', function (e) {
    e.preventDefault();
    setMsg('err-enrol', '');
    sb.auth.mfa.challengeAndVerify({ factorId: enrolFactorId, code: $('enrol-code').value.trim() }).then(function (r) {
      if (r.error) { setMsg('err-enrol', 'That code did not verify. Try the next code from your app.'); return; }
      enterConsole();
    });
  });

  var challengeFactorId = null;
  function challenge(factorId) {
    challengeFactorId = factorId;
    show('mfa');
    $('mfa-code').value = '';
    $('mfa-code').focus();
  }
  $('form-mfa').addEventListener('submit', function (e) {
    e.preventDefault();
    setMsg('err-mfa', '');
    sb.auth.mfa.challengeAndVerify({ factorId: challengeFactorId, code: $('mfa-code').value.trim() }).then(function (r) {
      if (r.error) { setMsg('err-mfa', 'That code did not verify. Try again.'); return; }
      enterConsole();
    });
  });

  $('btn-signout').addEventListener('click', function () {
    sb.auth.signOut().then(function () { window.location.reload(); });
  });

  function enterConsole() {
    api('me').then(function (r) {
      if (r.__status === 403 && r.code === 'mfa_required') return afterSignIn();
      if (!r.ok) {
        $('denied-text').textContent = r.error || 'This account is not authorized for the portal.';
        return show('denied');
      }
      me = r;
      $('me-line').textContent = r.email + (r.mode !== 'live' ? ' · client intake is ' + (r.mode === 'off' ? 'OFF' : 'not yet live') : '') + (window.__portalScanner === 'endpoint-only' ? ' · no server-side virus scan: rely on your antivirus' : '');
      show('console');
      return Promise.all([api('templates'), loadRequests()]).then(function (res) {
        templates = res[0].templates || [];
        var sel = $('f-template');
        templates.forEach(function (t) {
          var o = document.createElement('option');
          o.value = t.slug; o.textContent = t.name;
          sel.appendChild(o);
        });
      });
    });
  }

  // ------------------------------------------------------------------
  // Requests list
  // ------------------------------------------------------------------
  function loadRequests() {
    return api('requests').then(function (r) {
      requests = r.requests || [];
      var ul = $('request-list');
      ul.innerHTML = '';
      if (!requests.length) ul.innerHTML = '<li class="portal-muted">No requests yet.</li>';
      requests.forEach(function (q) {
        var c = q.counts || {};
        var recv = (c.pending_scan || 0) + (c.clean || 0) + (c.infected || 0) + (c.scan_failed || 0);
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        if (current && current.id === q.id) b.className = 'is-active';
        b.innerHTML = '<span class="ref">' + esc(q.reference) + '</span> <span class="staff-pill ' + esc(q.status) + '">' + esc(q.status) + '</span>' +
          '<span class="org">' + esc(q.orgName) + '</span>' +
          '<span class="sub">' + recv + ' file' + (recv === 1 ? '' : 's') + (c.clean ? ' · ' + c.clean + ' cleared' : '') + (c.pending_scan ? ' · ' + c.pending_scan + ' scanning' : '') + '</span>';
        b.addEventListener('click', function () { openRequest(q.id); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      return r;
    });
  }

  // ------------------------------------------------------------------
  // Create / edit form
  // ------------------------------------------------------------------
  var editingId = null;

  $('f-template').addEventListener('change', function () {
    var t = templates.filter(function (x) { return x.slug === $('f-template').value; })[0];
    if (!t) return;
    if (!$('f-purpose').value) $('f-purpose').value = t.purpose;
    var lines = [t.instructions, ''];
    (t.checklist || []).forEach(function (g) {
      if (g.group) lines.push(g.group.toUpperCase());
      (g.items || []).forEach(function (it) { lines.push('- ' + it.label + (it.note ? ' (' + it.note + ')' : '')); });
      lines.push('');
    });
    $('f-instructions').value = lines.join('\n').trim();
  });

  function showForm(q) {
    editingId = q ? q.id : null;
    current = q || null;
    $('form-title').textContent = q ? 'Edit ' + q.reference : 'New request';
    $('f-template').value = '';
    $('f-template').disabled = !!q;
    $('f-org').value = q ? q.orgName : '';
    $('f-purpose').value = q ? q.purpose : '';
    $('f-email').value = q ? q.recipientEmail : '';
    $('f-email').disabled = !!(q && q.status !== 'draft');
    $('f-expiry').value = 7;
    $('f-expiry').parentElement.hidden = !!q;
    $('f-instructions').value = q ? q.instructions : '';
    $('detail-empty').hidden = true;
    $('detail').hidden = true;
    $('form-request').hidden = false;
  }
  $('btn-new').addEventListener('click', function () { showForm(null); });
  $('btn-cancel-form').addEventListener('click', function () {
    $('form-request').hidden = true;
    if (current) openRequest(current.id); else $('detail-empty').hidden = false;
  });

  $('form-request').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      orgName: $('f-org').value, purpose: $('f-purpose').value, recipientEmail: $('f-email').value,
      instructions: $('f-instructions').value, expiryDays: $('f-expiry').value,
    };
    var p = editingId ? api('requests/' + editingId, { method: 'PATCH', body: body }) : api('requests', { method: 'POST', body: body });
    p.then(function (r) {
      if (!r.ok) return err(r.error || 'Could not save.');
      ok(editingId ? 'Saved.' : 'Draft created. Review it, then issue the link.');
      $('form-request').hidden = true;
      loadRequests().then(function () { openRequest(r.request.id); });
    });
  });

  // ------------------------------------------------------------------
  // Detail
  // ------------------------------------------------------------------
  function openRequest(id) {
    api('requests/' + id).then(function (r) {
      if (!r.ok) return err('Could not load the request.');
      current = r.request;
      renderDetail(r);
      loadRequests();
    });
  }

  function renderDetail(r) {
    var q = r.request;
    $('form-request').hidden = true;
    $('detail-empty').hidden = true;
    $('detail').hidden = false;
    $('d-invite').hidden = true;
    $('d-ref').textContent = q.reference;
    $('d-org').textContent = q.orgName;
    $('d-status').textContent = q.status;
    $('d-status').className = 'staff-pill ' + q.status;
    $('d-purpose').textContent = q.purpose;
    $('d-email').textContent = q.recipientEmail;
    $('d-expires').textContent = q.status === 'draft' ? 'Not issued yet' : fmtDate(q.expiresAt);
    $('d-created').textContent = fmtDate(q.createdAt);

    var actions = $('d-actions');
    actions.innerHTML = '';
    function btn(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cta-button portal-btn portal-btn-sm ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    }
    if (q.status === 'draft' || q.status === 'open') {
      btn('Edit', 'portal-btn-secondary', function () { showForm(q); });
      btn(q.status === 'draft' ? 'Issue link' : 'Issue new link (revokes old)', '', function () {
        var days = window.prompt('Link valid for how many days?', '7');
        if (days === null) return;
        api('requests/' + q.id + '/issue', { method: 'POST', body: { expiryDays: days } }).then(function (x) {
          if (!x.ok) return err(x.error || 'Could not issue the link.');
          var box = $('d-invite');
          box.hidden = false;
          box.innerHTML = '<strong>Invite link (shown once; copy it now):</strong><br>' + esc(x.inviteUrl) +
            '<div style="margin-top:.6rem"><button type="button" class="portal-link" id="btn-copy">Copy link</button></div>';
          $('btn-copy').addEventListener('click', function () {
            navigator.clipboard.writeText(x.inviteUrl).then(function () { ok('Link copied. Send it to the recipient yourself; the portal does not email invites.'); });
          });
          loadRequests();
          api('requests/' + q.id).then(function (d) { if (d.ok) { current = d.request; renderDetailKeepInvite(d); } });
        });
      });
      btn(q.status === 'draft' ? 'Discard' : 'Close request', 'portal-btn-danger', function () {
        if (!window.confirm('Close this request? The link stops working immediately and no further uploads are accepted.')) return;
        api('requests/' + q.id + '/close', { method: 'POST', body: { revoke: q.status === 'open' && window.confirm('Mark as revoked (suspected misuse) instead of a normal close? OK = revoked, Cancel = closed.') } }).then(function () { openRequest(q.id); });
      });
    }

    var tb = $('d-files');
    tb.innerHTML = '';
    $('d-files-empty').hidden = !!(r.files && r.files.length);
    (r.files || []).forEach(function (f) {
      var tr = document.createElement('tr');
      var statusLabel = { pending_scan: 'scanning', clean: f.serverScanned ? 'cleared' : 'released, not scanned', scan_failed: 'scan failed', infected: 'blocked (malware)', rejected: 'rejected' + (f.rejectionReason ? ': ' + f.rejectionReason : ''), deleted: 'deleted' }[f.status] || f.status;
      tr.innerHTML = '<td class="name"></td><td class="desc"></td><td>' + fmtBytes(f.size) + '</td><td>' + esc(fmtDate(f.uploadedAt)) + '</td>' +
        '<td><span class="staff-pill ' + esc(f.status) + '">' + esc(statusLabel) + '</span></td><td class="staff-row"></td>';
      tr.querySelector('.name').textContent = f.originalName;
      tr.querySelector('.name').title = f.originalName;
      tr.querySelector('.desc').textContent = f.description || '\u2014';
      var cell = tr.querySelector('.staff-row');
      function a(label, fn, cls) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'portal-link ' + (cls || ''); b.textContent = label;
        b.addEventListener('click', fn); cell.appendChild(b);
      }
      if (f.status === 'clean') a('Download', function () {
        api('files/' + f.id + '/download', { method: 'POST' }).then(function (x) {
          if (!x.ok) return err(x.error || 'Download refused.');
          window.open(x.url, '_blank', 'noopener');
        });
      });
      if (f.status === 'scan_failed') a('Rescan', function () {
        api('files/' + f.id + '/rescan', { method: 'POST' }).then(function () { setTimeout(function () { openRequest(q.id); }, 1500); });
      });
      if (f.status !== 'deleted') a('Delete', function () {
        if (!window.confirm('Permanently delete this file from storage? This cannot be undone.')) return;
        api('files/' + f.id, { method: 'DELETE' }).then(function () { openRequest(q.id); });
      });
      tb.appendChild(tr);
    });

    var au = $('d-audit');
    au.innerHTML = '';
    (r.audit || []).forEach(function (ev) {
      var li = document.createElement('li');
      li.textContent = fmtDate(ev.at) + ' · ' + ev.actor_type + ' · ' + ev.event + (ev.detail ? ' ' + JSON.stringify(ev.detail) : '');
      au.appendChild(li);
    });
  }
  function renderDetailKeepInvite(r) {
    var html = $('d-invite').innerHTML;
    var hidden = $('d-invite').hidden;
    renderDetail(r);
    $('d-invite').innerHTML = html;
    $('d-invite').hidden = hidden;
    var copy = $('btn-copy');
    if (copy) copy.addEventListener('click', function () {
      navigator.clipboard.writeText($('d-invite').textContent.replace(/^.*?https?:\/\//, 'https://').replace(/Copy link$/, '').trim());
    });
  }

  boot();
})();
