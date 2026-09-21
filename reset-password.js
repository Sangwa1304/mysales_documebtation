const token = new URLSearchParams(window.location.search).get("token");

const form = document.getElementById("resetForm");

const password = document.getElementById("password");

const confirmation = document.getElementById("confirm");

const button = document.getElementById("btn");

const message = document.getElementById("message");

// ======================================================
// VÉRIFIER LE TOKEN
// ======================================================

if (!token) {
  form.style.display = "none";

  message.textContent = "Lien de réinitialisation invalide ou incomplet.";

  message.className = "form-message error";
}

// ======================================================
// RÉINITIALISER LE MOT DE PASSE
// ======================================================

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!token) {
    return;
  }

  if (password.value.length < 8) {
    message.textContent =
      "Le mot de passe doit contenir au moins 8 caractères.";

    message.className = "form-message error";

    return;
  }

  if (password.value !== confirmation.value) {
    message.textContent = "Les deux mots de passe ne correspondent pas.";

    message.className = "form-message error";

    return;
  }

  button.disabled = true;

  button.textContent = "Enregistrement...";

  message.textContent = "";

  message.className = "form-message";

  try {
    const response = await fetch("/api/reset-password", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        token: token,

        mot_de_passe: password.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Impossible de réinitialiser le mot de passe.",
      );
    }

    message.textContent = data.message || "Mot de passe modifié avec succès.";

    message.className = "form-message success";

    form.reset();

    setTimeout(function () {
      window.location.href = "/login.html";
    }, 1800);
  } catch (error) {
    console.error("Erreur réinitialisation :", error);

    message.textContent = error.message || "Une erreur est survenue.";

    message.className = "form-message error";

    button.disabled = false;

    button.textContent = "Enregistrer";
  }
});
