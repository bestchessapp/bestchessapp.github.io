// BEST CHESS web: the browser side. Everything the game needs from the page
// lives here, behind small functions the Dart code calls (lib/web/bridge.dart):
// the CrazyGames SDK (v3), saved data, sounds and the chess engine.
//
// Every function is safe to call when the CrazyGames SDK is missing or
// disabled (a local test, an adblocker): the game then still runs, saves in
// the browser, and shows no ads.
(function () {
  'use strict';

  var sdk = null; // window.CrazyGames.SDK once it is initialised and usable
  var playing = false;
  var sdkMuted = false; // the CrazyGames "mute audio" setting
  var adMuted = false; // an ad is playing

  function attempt(fn) {
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  }

  // ------------------------------------------------------------ SDK

  // Initialises the SDK (at most 6 seconds; then the game starts without it).
  window.bcInit = function () {
    var init = (async function () {
      try {
        var s = window.CrazyGames && window.CrazyGames.SDK;
        if (!s) return;
        await s.init();
        if (s.environment === 'disabled') return;
        sdk = s;
        attempt(function () { sdk.game.loadingStart(); });
        attempt(function () {
          sdkMuted = !!sdk.game.settings.muteAudio;
          sdk.game.addSettingsChangeListener(function (settings) {
            sdkMuted = !!settings.muteAudio;
            if (sdkMuted) stopAll();
          });
        });
      } catch (e) {
        sdk = null;
      }
    })();
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 6000); });
    return Promise.race([init, timeout]);
  };

  window.bcLoadingStop = function () {
    var loader = document.getElementById('bc-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(function () { attempt(function () { loader.remove(); }); }, 350);
    }
    if (sdk) attempt(function () { sdk.game.loadingStop(); });
  };

  // Play started or resumed (a puzzle on the board, a game in progress).
  window.bcGameplayStart = function () {
    if (playing) return;
    playing = true;
    if (sdk) attempt(function () { sdk.game.gameplayStart(); });
  };

  // A break: puzzle finished, game over, back to the menu.
  window.bcGameplayStop = function () {
    if (!playing) return;
    playing = false;
    if (sdk) attempt(function () { sdk.game.gameplayStop(); });
  };

  // A natural break between two puzzles or two games: asks for a midgame
  // ad. CrazyGames itself limits how often one really shows (and shows none
  // in a Basic Launch); the game goes on either way.
  window.bcBreak = function () {
    if (!sdk) return;
    attempt(function () {
      sdk.ad.requestAd('midgame', {
        adStarted: function () { adMuted = true; stopAll(); },
        adFinished: function () { adMuted = false; },
        adError: function () { adMuted = false; },
      });
    });
  };

  // A big moment (a new title, a won game): CrazyGames' celebration.
  window.bcHappy = function () {
    if (sdk) attempt(function () { sdk.game.happytime(); });
  };

  // ------------------------------------------------------------ saved data

  // CrazyGames' Data module when available (it follows the player's
  // account), else the browser's own storage, else memory.
  var memory = {};
  var prefix = 'bestchess.';

  function local() {
    return attempt(function () { return window.localStorage; }) || null;
  }

  window.bcStoreGet = function (key) {
    var value;
    if (sdk) {
      value = attempt(function () { return sdk.data.getItem(prefix + key); });
      if (value !== undefined) return value === null ? null : String(value);
    }
    var store = local();
    if (store) {
      value = attempt(function () { return store.getItem(prefix + key); });
      if (value !== undefined) return value;
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  };

  window.bcStoreSet = function (key, value) {
    memory[key] = value;
    if (sdk) {
      var saved = attempt(function () {
        sdk.data.setItem(prefix + key, value);
        return true;
      });
      if (saved) return;
    }
    var store = local();
    if (store) attempt(function () { store.setItem(prefix + key, value); });
  };

  // ------------------------------------------------------------ sounds

  var context = null;
  var buffers = {};
  var sounding = [];

  function audio() {
    if (!context) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      context = attempt(function () { return new Ctor(); }) || null;
    }
    return context;
  }

  // Browsers start audio only after a touch, click or key; iOS also
  // suspends it when the page was in the background.
  function resume() {
    if (context && context.state !== 'running') {
      attempt(function () { context.resume(); });
    }
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (type) {
    window.addEventListener(type, resume, true);
  });

  // names: "move,capture,…" (files in assets/sounds/<name>.wav).
  window.bcSoundLoad = function (names) {
    var ctx = audio();
    if (!ctx) return;
    names.split(',').forEach(function (name) {
      fetch('assets/assets/sounds/' + name + '.wav')
        .then(function (response) {
          if (!response.ok) throw new Error('missing');
          return response.arrayBuffer();
        })
        .then(function (data) { return ctx.decodeAudioData(data); })
        .then(function (buffer) { buffers[name] = buffer; })
        .catch(function () {});
    });
  };

  window.bcSoundPlay = function (name) {
    if (sdkMuted || adMuted) return;
    var ctx = audio();
    var buffer = buffers[name];
    if (!ctx || !buffer || ctx.state !== 'running') return;
    attempt(function () {
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = function () {
        var i = sounding.indexOf(source);
        if (i >= 0) sounding.splice(i, 1);
      };
      sounding.push(source);
      source.start();
    });
  };

  function stopAll() {
    sounding.splice(0).forEach(function (source) {
      attempt(function () { source.stop(); });
    });
  }
  window.bcSoundStopAll = stopAll;

  // ------------------------------------------------------------ fetch

  // Text from a public web address (Chess.com and Lichess game lists).
  // Rejects with "HTTP <status>" or a network error.
  window.bcFetchText = function (url, accept) {
    var init = accept ? { headers: { Accept: accept } } : {};
    return fetch(url, init).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  };

  // ------------------------------------------------------------ full screen

  // The browser's own full screen (the whole page, or the frame the game is
  // shown in on the website). Not offered on CrazyGames, which has its own
  // full-screen button, nor where the browser can't (iPhone Safari).
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  window.bcFsAvailable = function () {
    if (sdk) return false;
    var el = document.documentElement;
    var can = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    return !!(can && (el.requestFullscreen || el.webkitRequestFullscreen));
  };
  window.bcFsActive = function () { return !!fsElement(); };
  window.bcFsToggle = function () {
    attempt(function () {
      if (fsElement()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        var el = document.documentElement;
        var p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (p && p.catch) p.catch(function () {});
      }
    });
  };
  window.bcFsListen = function (onChange) {
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (type) {
      document.addEventListener(type, function () { onChange(!!fsElement()); });
    });
  };

  // ------------------------------------------------------------ engine

  // Stockfish runs as a separate program in its own Web Worker; the game
  // talks to it only with UCI text lines (see web/engine/README.txt).
  var worker = null;

  window.bcEngineStart = function (onLine, onFail) {
    if (worker) return;
    var w;
    try {
      w = new Worker('engine/stockfish-19-lite-single.js');
    } catch (e) {
      onFail();
      return;
    }
    worker = w;
    w.onmessage = function (event) {
      if (worker !== w || typeof event.data !== 'string') return;
      event.data.split('\n').forEach(function (line) { onLine(line); });
    };
    w.onerror = function () {
      if (worker !== w) return;
      worker = null;
      attempt(function () { w.terminate(); });
      onFail();
    };
  };

  window.bcEngineSend = function (command) {
    if (worker) worker.postMessage(command);
  };

  window.bcEngineStop = function () {
    if (!worker) return;
    var w = worker;
    worker = null;
    attempt(function () { w.terminate(); });
  };
})();
