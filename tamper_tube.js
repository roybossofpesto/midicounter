// ==UserScript==
// @name         YouTube Turntable Pitch (Mono Legato MIDI + UI)
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
        uiUpdate(semi);
    }

    /* ---------- UI ---------- */
    const ui = document.createElement("div");
    ui.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px;
        font-family: sans-serif;
        font-size: 14px;
        border-radius: 8px;
        z-index: 9999;
        min-width: 180px;
    `;

    // Hold last note checkbox
    const holdContainer = document.createElement("label");
    holdContainer.style.display = "block";
    holdContainer.style.marginBottom = "6px";
    holdContainer.style.cursor = "pointer";

    const holdCheckbox = document.createElement("input");
    holdCheckbox.type = "checkbox";
    holdCheckbox.checked = false;
    holdCheckbox.style.marginRight = "6px";
    holdContainer.appendChild(holdCheckbox);
    holdContainer.appendChild(document.createTextNode("Hold Last Note"));

    // Pitch display
    const pitchLabel = document.createElement("div");
    pitchLabel.textContent = "Pitch: 0 semitones";

    // Slider for manual override
    const pitchSlider = document.createElement("input");
    pitchSlider.type = "range";
    pitchSlider.min = -24;
    pitchSlider.max = 24;
    pitchSlider.value = 0;
    pitchSlider.step = 0.1;
    pitchSlider.style.width = "100%";


    // // Held notes stack
    // const heldNotesLabel = document.createElement("div");
    // heldNotesLabel.textContent = "Held Notes: []";

    ui.appendChild(holdContainer);
    ui.appendChild(pitchLabel);
    ui.appendChild(pitchSlider);
    // ui.appendChild(heldNotesLabel);
    document.body.appendChild(ui);

    /* ---------- state ---------- */
    let heldNotes = [];
    let currentVideo;
    let midiEnabled = true;

    pitchSlider.oninput = () => {
        applySemi(currentVideo, parseFloat(pitchSlider.value));
    };

    function uiUpdate(semi) {
        pitchLabel.textContent = `Pitch: ${semi.toFixed(2)} semitones`;
        pitchSlider.value = semi;
        // heldNotesLabel.textContent = `Held Notes: [${heldNotes.join(", ")}]`;
    }

    /* ---------- MIDI handling ---------- */
    function initMIDI(video) {
        if (!navigator.requestMIDIAccess) {
            console.warn("Web MIDI not supported");
            return;
        }

        navigator.requestMIDIAccess().then(midi => {
            console.log("MIDI ready");

            for (const input of midi.inputs.values()) {
                input.onmidimessage = e => {
                    if (!midiEnabled) return;

                    const [status, note, velocity] = e.data;
                    const type = status & 0xf0;

                    // NOTE ON
                    if (type === 0x90 && velocity > 0) {
                        heldNotes = heldNotes.filter(n => n !== note);
                        heldNotes.push(note);
                        const top = heldNotes[heldNotes.length - 1];
                        applySemi(video, top - 60);
                    }

                    // NOTE OFF
                    if (type === 0x80 || (type === 0x90 && velocity === 0)) {
                        heldNotes = heldNotes.filter(n => n !== note);

                        if (!holdCheckbox.checked) {
                            // normal legato behavior
                            if (heldNotes.length > 0) {
                                const top = heldNotes[heldNotes.length - 1];
                                applySemi(video, top - 60);
                            } else {
                                applySemi(video, 0);
                            }
                        } else {
                            // Hold last note: do nothing on note release
                            if (heldNotes.length === 0) {
                                applySemi(video, note - 60);
                            }
                        }
                    }
                };
            }
        });
    }

    /* ---------- init ---------- */
    waitForVideo(v => {
        currentVideo = v;
        initMIDI(v);
        console.log("YT turntable pitch (mono legato) with UI active");
    });

})();
