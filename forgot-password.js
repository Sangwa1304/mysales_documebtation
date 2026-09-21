/* =========================================================
   MYSALES — MOT DE PASSE OUBLIÉ
   ========================================================= */

const forgotPasswordForm = document.getElementById("forgotPasswordForm");

const emailInput = document.getElementById("email");

const boutonEnvoyer = document.getElementById("boutonEnvoyer");

const texteBouton = document.getElementById("texteBouton");

const message = document.getElementById("message");

/* =========================================================
   AFFICHER MESSAGE
   ========================================================= */

function afficherMessage(texte, type = "success") {
  message.textContent = texte;

  message.hidden = false;

  if (type === "success") {
    message.className = "alert alert-success";
  } else {
    message.className = "alert alert-danger";
  }
}

/* =========================================================
   CACHER MESSAGE
   ========================================================= */

function cacherMessage() {
  message.hidden = true;

  message.textContent = "";
}

/* =========================================================
   FORMULAIRE
   ========================================================= */

forgotPasswordForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  cacherMessage();

  const email = emailInput.value.trim();

  if (!email) {
    afficherMessage("Veuillez saisir votre adresse e-mail.", "error");

    return;
  }

  boutonEnvoyer.disabled = true;

  texteBouton.textContent = "Envoi en cours...";

  try {
    const response = await fetch("/api/forgot-password", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        email: email,
      }),
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || "Impossible de traiter la demande.");
    }

    afficherMessage(
      data?.message ||
        "Si cette adresse existe, un lien de réinitialisation a été envoyé.",
      "success",
    );

    emailInput.value = "";
  } catch (error) {
    console.error("Erreur mot de passe oublié :", error);

    afficherMessage(
      error.message || "Impossible de traiter la demande.",
      "error",
    );
  } finally {
    boutonEnvoyer.disabled = false;

    texteBouton.textContent = "Envoyer le lien";
  }
});
