// ==UserScript==
// @name         YouTube Turntable Pitch (Mono Legato MIDI)
// @namespace    yt-pitch
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ---------- math ---------- */

    function semitoneToRate(semi) {
        return Math.pow(2, semi / 12);
    }

    /* ---------- video handling ---------- */

    function waitForVideo(cb) {
        const id = setInterval(() => {
            const v = document.querySelector("video");
            if (v) {
                clearInterval(id);
                cb(v);
            }
        }, 200);
    }

    function applySemi(video, semi) {
        video.preservesPitch = false;
        video.playbackRate = semitoneToRate(semi);
    }

    /* ---------- MIDI mono legato ---------- */

    let heldNotes = []; // stack of MIDI notes

    function initMIDI(video) {
        if (!navigator.requestMIDIAccess) {
            console.warn("Web MIDI not supported");
            return;
        }

        navigator.requestMIDIAccess().then(midi => {
            console.log("MIDI ready");

            for (const input of midi.inputs.values()) {
                input.onmidimessage = e => {
                    const [status, note, velocity] = e.data;
                    const type = status & 0xf0;

                    // NOTE ON
                    if (type === 0x90 && velocity > 0) {
                        // remove duplicates
                        heldNotes = heldNotes.filter(n => n !== note);
                        heldNotes.push(note);

                        const top = heldNotes[heldNotes.length - 1];
                        applySemi(video, top - 60);
                    }

                    // NOTE OFF (or note on with vel 0)
                    if (type === 0x80 || (type === 0x90 && velocity === 0)) {
                        heldNotes = heldNotes.filter(n => n !== note);

                        if (heldNotes.length > 0) {
                            const top = heldNotes[heldNotes.length - 1];
                            applySemi(video, top - 60);
                        } else {
                            applySemi(video, 0);
                        }
                    }
                };
            }
        });
    }

    /* ---------- init ---------- */

    waitForVideo(v => {
        initMIDI(v);
        console.log("YT turntable pitch (mono legato) active");
    });

})();
