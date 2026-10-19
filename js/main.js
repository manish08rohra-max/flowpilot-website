/* FlowPilot — site interactions */
(function () {
  "use strict";

  /* ---------- Optional Formspree endpoint ----------
     Leave "" to use Netlify Forms (requires hosting on Netlify with
     form processing enabled — see README). If you use Formspree instead,
     set this to your endpoint, e.g. "https://formspree.io/f/abcdwxyz".
     No keys or credentials are stored in this repository. */
  var FORM_ACTION = "";

  var CONTACT_EMAIL = "info@flowpilotai.co.in";

  /* ---------- Sticky header ---------- */
  var header = document.getElementById("siteHeader");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 10); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var open = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  /* ---------- Solutions explorer: tabs + animated workflow strips ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll("[role='tab']"));
    var panels = Array.prototype.slice.call(root.querySelectorAll("[role='tabpanel']"));
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var flowTimer = null;

    var startFlow = function (panel) {
      if (flowTimer) { window.clearInterval(flowTimer); flowTimer = null; }
      if (!panel || reduceMotion) return;
      var stepEls = panel.querySelectorAll(".flow-step");
      if (!stepEls.length) return;
      var i = 0;
      var paused = false;
      panel.addEventListener("mouseenter", function () { paused = true; });
      panel.addEventListener("mouseleave", function () { paused = false; });
      var setFlow = function (n) {
        stepEls.forEach(function (s, j) {
          s.classList.toggle("is-active", j === n);
          s.classList.toggle("is-done", j < n);
        });
      };
      setFlow(0);
      flowTimer = window.setInterval(function () {
        if (paused) return;
        i = (i + 1) % stepEls.length;
        setFlow(i);
      }, 1500);
    };

    var select = function (index) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      panels.forEach(function (panel, i) {
        panel.hidden = i !== index;
      });
      startFlow(panels[index]);
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(i); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          select(next);
          tabs[next].focus();
        }
      });
    });

    /* Deep links: services.html#email-admin activates that tab */
    var activateFromHash = function () {
      var hash = window.location.hash.replace("#", "");
      if (!hash) return;
      var idx = panels.findIndex(function (p) { return p.id === hash; });
      if (idx >= 0) select(idx);
    };
    select(0);
    activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
  });

  /* ---------- Copy-to-clipboard buttons ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          var original = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(function () { btn.textContent = original; }, 1600);
        }).catch(function () { /* clipboard unavailable */ });
      }
    });
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Hero pipeline: cycles through the flow, pauses on hover ---------- */
  var pipeline = document.getElementById("heroPipeline");
  if (pipeline) {
    var steps = pipeline.querySelectorAll(".pipe-step");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var setStep = function (active) {
      steps.forEach(function (s, i) {
        s.classList.toggle("is-active", i === active);
        s.classList.toggle("is-done", i < active);
        var status = s.querySelector(".pipe-status");
        if (status) status.textContent = i < active ? "done" : i === active ? "running" : "queued";
      });
    };

    if (reduceMotion || steps.length === 0) {
      setStep(0);
    } else {
      var idx = 0;
      var timer = null;
      var start = function () {
        if (timer) return;
        timer = window.setInterval(function () {
          idx = (idx + 1) % steps.length;
          setStep(idx);
        }, 2200);
      };
      var stop = function () {
        if (timer) { window.clearInterval(timer); timer = null; }
      };
      setStep(0);
      start();
      pipeline.addEventListener("mouseenter", stop);
      pipeline.addEventListener("mouseleave", start);
    }
  }

  /* ---------- Insurance pain-point picker ---------- */
  var pickGrid = document.getElementById("pickGrid");
  if (pickGrid) {
    var pickCta = document.getElementById("pickCta");
    var pickNote = document.getElementById("pickNote");
    var pickDefault = pickCta.textContent;

    var updatePicks = function () {
      var picked = [];
      pickGrid.querySelectorAll("input:checked").forEach(function (input) {
        picked.push(input.value);
      });
      try { sessionStorage.setItem("fpPicks", JSON.stringify(picked)); } catch (e) { /* storage blocked */ }
      if (picked.length) {
        pickCta.textContent = "Request an Automation Assessment (" + picked.length + ")";
        pickNote.textContent = picked.length + " selected — they'll be pre-filled on the contact form.";
        pickNote.hidden = false;
      } else {
        pickCta.textContent = pickDefault;
        pickNote.hidden = true;
      }
    };
    pickGrid.addEventListener("change", updatePicks);
    updatePicks();
  }

  /* ---------- Preselect "area of interest" from query string ----------
     e.g. contact.html?topic=insurance (used by insurance-page CTAs). */
  var topicSelect = document.getElementById("cf-topic");
  if (topicSelect) {
    var q = new URLSearchParams(window.location.search).get("topic");
    if (q) {
      Array.prototype.forEach.call(topicSelect.options, function (opt) {
        if (opt.value === q) topicSelect.value = q;
      });
    }
  }

  /* ---------- Pre-fill message from insurance picker ---------- */
  var msgField = document.getElementById("cf-message");
  if (msgField && !msgField.value) {
    try {
      var savedPicks = JSON.parse(sessionStorage.getItem("fpPicks") || "[]");
      if (savedPicks.length) {
        msgField.value = "Processes we'd like to automate:\n- " + savedPicks.join("\n- ");
      }
    } catch (e) { /* storage blocked */ }
  }

  /* ---------- Contact form ----------
     Delivery order: Formspree (if FORM_ACTION set) → Netlify Forms →
     mailto fallback. The fallback never silently drops the enquiry:
     it opens the visitor's email app pre-filled and says so. */
  var form = document.getElementById("contactForm");
  if (form) {
    var successBox = document.getElementById("formSuccess");
    var errorBox = document.getElementById("formError");

    var showBox = function (el, message) {
      if (message) el.querySelector(".box-msg").textContent = message;
      el.classList.add("show");
    };
    var hideBox = function (el) { el.classList.remove("show"); };

    var setInvalid = function (field, invalid) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.toggle("invalid", invalid);
      field.setAttribute("aria-invalid", String(invalid));
    };

    var validate = function () {
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (field) {
        var value = field.value.trim();
        var valid = value.length > 0;
        if (valid && field.type === "email") {
          valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }
        setInvalid(field, !valid);
        if (!valid) ok = false;
      });
      return ok;
    };

    var postNetlify = function (data) {
      var body = new URLSearchParams();
      body.append("form-name", form.getAttribute("name") || "enquiry");
      data.forEach(function (value, key) { body.append(key, value); });
      return fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      }).then(function (res) {
        if (!res.ok) throw new Error("Submission failed (" + res.status + ")");
      });
    };

    var postFormspree = function (data) {
      return fetch(FORM_ACTION, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: data
      }).then(function (res) {
        if (!res.ok) throw new Error("Submission failed (" + res.status + ")");
      });
    };

    var mailtoFallback = function (data) {
      var subject = encodeURIComponent("Website enquiry — " + (data.get("topic") || "General"));
      var body = encodeURIComponent(
        "Name: " + data.get("name") +
        "\nBusiness: " + (data.get("business") || "-") +
        "\nEmail: " + data.get("email") +
        "\nArea of interest: " + (data.get("topic") || "-") +
        "\n\nWorkflow / problem:\n" + data.get("message")
      );
      window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + subject + "&body=" + body;
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideBox(successBox);
      hideBox(errorBox);

      /* Honeypot: silently accept if a bot filled the hidden field. */
      var hp = form.querySelector(".hp-field input");
      if (hp && hp.value) {
        showBox(successBox, "Thank you — your enquiry has been received.");
        form.reset();
        return;
      }

      if (!validate()) return;

      var data = new FormData(form);
      var btn = form.querySelector("button[type='submit']");
      btn.disabled = true;

      var delivery = FORM_ACTION ? postFormspree(data) : postNetlify(data);

      delivery.then(function () {
        showBox(successBox, "Thank you — your enquiry has been sent. We'll get back to you shortly.");
        form.reset();
        try { sessionStorage.removeItem("fpPicks"); } catch (err) { /* storage blocked */ }
      }).catch(function () {
        /* Configured provider unavailable (e.g. local preview or host
           without form processing). Fall back to the visitor's email
           app so the enquiry is never silently lost. */
        mailtoFallback(data);
        showBox(errorBox,
          "Direct web submission isn't active yet. Your email app should now open with your message " +
          "addressed to " + CONTACT_EMAIL + " — just press send. If it didn't open, email us at " + CONTACT_EMAIL + ".");
      }).finally(function () {
        btn.disabled = false;
      });
    });

    form.querySelectorAll("[required]").forEach(function (field) {
      field.addEventListener("input", function () { setInvalid(field, false); });
    });
  }
})();
