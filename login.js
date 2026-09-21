/* =========================================================
   MYSALES — CONNEXION
   ========================================================= */

const loginForm = document.getElementById("loginForm");

const emailInput = document.getElementById("email");

const motDePasseInput = document.getElementById("motDePasse");

const boutonConnexion = document.getElementById("boutonConnexion");

const texteConnexion = document.getElementById("texteConnexion");

const message = document.getElementById("message");

const voirMotDePasse = document.getElementById("voirMotDePasse");

const seSouvenir = document.getElementById("seSouvenir");

/* =========================================================
   AFFICHER / MASQUER LE MOT DE PASSE
   ========================================================= */

if (voirMotDePasse) {
  voirMotDePasse.addEventListener("click", function () {
    if (motDePasseInput.type === "password") {
      motDePasseInput.type = "text";

      voirMotDePasse.textContent = "🙈";

      voirMotDePasse.setAttribute("aria-label", "Masquer le mot de passe");

      voirMotDePasse.setAttribute("title", "Masquer le mot de passe");
    } else {
      motDePasseInput.type = "password";

      voirMotDePasse.textContent = "👁️";

      voirMotDePasse.setAttribute("aria-label", "Afficher le mot de passe");

      voirMotDePasse.setAttribute("title", "Afficher le mot de passe");
    }
  });
}

/* =========================================================
   MESSAGE
   ========================================================= */

function afficherErreur(texte) {
  message.textContent = texte;

  message.className = "alert alert-danger";

  message.hidden = false;
}

function cacherMessage() {
  message.hidden = true;

  message.textContent = "";
}

/* =========================================================
   CHARGER EMAIL MÉMORISÉ
   ========================================================= */

try {
  const emailMemorise = localStorage.getItem("mysales_email");

  if (emailMemorise) {
    emailInput.value = emailMemorise;

    seSouvenir.checked = true;
  }
} catch (error) {
  console.warn("Impossible de lire le stockage local.");
}

/* =========================================================
   CONNEXION
   ========================================================= */

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  cacherMessage();

  const email = emailInput.value.trim();

  const motDePasse = motDePasseInput.value;

  /* =====================================================
       VALIDATION
       ===================================================== */

  if (!email || !motDePasse) {
    afficherErreur("Veuillez remplir tous les champs.");

    return;
  }

  boutonConnexion.disabled = true;

  texteConnexion.textContent = "Connexion en cours...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      /*
       * IMPORTANT :
       *
       * Le serveur attend :
       * mot_de_passe
       *
       * et non :
       * motDePasse
       */

      body: JSON.stringify({
        email: email,

        mot_de_passe: motDePasse,
      }),
    });

    /* ===================================================
         RÉCUPÉRATION RÉPONSE
         =================================================== */

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    /* ===================================================
         ERREUR
         =================================================== */

    if (!response.ok) {
      throw new Error(
        data?.message || "Adresse e-mail ou mot de passe incorrect.",
      );
    }

    /* ===================================================
         MÉMORISATION EMAIL
         =================================================== */

    try {
      if (seSouvenir.checked) {
        localStorage.setItem("mysales_email", email);
      } else {
        localStorage.removeItem("mysales_email");
      }
    } catch (error) {
      console.warn("Impossible d'enregistrer l'e-mail.");
    }

    /* ===================================================
         CONNEXION RÉUSSIE
         =================================================== */

    window.location.href = "/index.html";
  } catch (error) {
    console.error("Erreur connexion :", error);

    afficherErreur(error.message || "Impossible de se connecter.");
  } finally {
    boutonConnexion.disabled = false;

    texteConnexion.textContent = "Se connecter";
  }
});
