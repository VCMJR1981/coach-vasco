/* Concrete Surfers — site behaviour. No dependencies. */
(function () {
  "use strict";

  var EMAIL = "info@concrete-surfers.com";

  /* ---- Year in footer ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---- Mobile menu ---- */
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("mobile-menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        burger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      }
    });
  }

  /* ---- CTAs preselect the right booking option ---- */
  var select = document.getElementById("option");
  document.querySelectorAll("[data-prefill]").forEach(function (el) {
    el.addEventListener("click", function () {
      if (!select) return;
      var wanted = el.getAttribute("data-prefill");
      var match = Array.prototype.find.call(select.options, function (o) {
        return o.text.indexOf(wanted) === 0;
      });
      if (match) select.value = match.value;
    });
  });

  /* ---- Booking form -> prefilled email ----
     No backend here on purpose: this deploys as static files.
     To switch to a form service (Formspree, Basin, a serverless
     endpoint), replace the body of submit() with a fetch() POST. */
  var form = document.getElementById("booking-form");
  var status = document.getElementById("form-status");

  function setError(field, on) {
    if (on) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = document.getElementById("name");
      var email = document.getElementById("email");
      var option = document.getElementById("option");
      var level = document.getElementById("level");
      var message = document.getElementById("message");

      var bad = false;
      if (!name.value.trim()) { setError(name, true); bad = true; } else setError(name, false);
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
      if (!emailOk) { setError(email, true); bad = true; } else setError(email, false);

      if (bad) {
        status.textContent = "Add your name and a valid email so I can reply.";
        status.classList.add("error");
        return;
      }
      status.classList.remove("error");

      var subject = "[Booking] " + option.value + " — " + name.value.trim();
      var body = [
        "Name: " + name.value.trim(),
        "Email: " + email.value.trim(),
        "Booking: " + option.value,
        "Experience: " + level.value,
        "",
        "What's not working:",
        message.value.trim() || "(nothing added)"
      ].join("\n");

      var href = "mailto:" + EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = href;
      status.textContent = "Opening your email app. If nothing happens, write to " + EMAIL + ".";
    });
  }

  /* ---- Reveal on scroll ---- */
  if ("IntersectionObserver" in window &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var targets = document.querySelectorAll(".card, .steps li, .checklist li, .method-list li, .about-media");
    targets.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = "opacity .5s ease, transform .5s ease";
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        setTimeout(function () {
          el.style.opacity = "1";
          el.style.transform = "none";
        }, i * 60);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }
})();
