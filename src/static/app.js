document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message and reset activity dropdown
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const participants = details.participants || [];
        const spotsLeft = details.max_participants - participants.length;

        // Build participants HTML (bulleted list or empty state)
        let participantsHtml = "";
        if (participants.length > 0) {
          participantsHtml = `
            <p class="participants-title">Participants:</p>
            <ul class="participants-list">
              ${participants
                .map(
                  (p) =>
                    `<li><span class="participant-email">${p}</span><button class="participant-remove" data-activity="${name}" data-email="${p}" aria-label="Remove ${p}">✕</button></li>`
                )
                .join("")}
            </ul>
          `;
        } else {
          participantsHtml = `<p class="participants-none">No participants yet</p>`;
        }

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsHtml}
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);

        // Attach remove handlers for participant buttons in this card
        activityCard.querySelectorAll(".participant-remove").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const activity = btn.dataset.activity;
            const email = btn.dataset.email;
            try {
              const res = await fetch(
                `/activities/${encodeURIComponent(activity)}/participants?email=${encodeURIComponent(email)}`,
                { method: "DELETE" }
              );

              const result = await res.json();
              if (res.ok) {
                messageDiv.textContent = result.message;
                messageDiv.className = "message success";
                messageDiv.classList.remove("hidden");
                // Refresh activities to reflect removal
                await fetchActivities();
              } else {
                messageDiv.textContent = result.detail || "Failed to remove participant";
                messageDiv.className = "message error";
                messageDiv.classList.remove("hidden");
              }

              setTimeout(() => messageDiv.classList.add("hidden"), 4000);
            } catch (err) {
              console.error("Error removing participant:", err);
              messageDiv.textContent = "Failed to remove participant";
              messageDiv.className = "message error";
              messageDiv.classList.remove("hidden");
              setTimeout(() => messageDiv.classList.add("hidden"), 4000);
            }
          });
        });
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";
        signupForm.reset();
        // Update the specific activity card immediately so the UI reflects the new participant
        updateActivityCard(activity, email);
        // Also refresh the activities list in the background to keep data in sync
        fetchActivities().catch((e) => console.warn("Background refresh failed", e));
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();

  // Helper: add the participant to the DOM for a given activity (no full refresh)
  function updateActivityCard(activityName, email) {
    // Find the activity card by its title
    const cards = Array.from(document.querySelectorAll(".activity-card"));
    const card = cards.find((c) => c.querySelector("h4") && c.querySelector("h4").textContent === activityName);
    if (!card) return;

    // Update availability text if present
    const availP = Array.from(card.querySelectorAll("p")).find((p) => p.textContent.includes("Availability:"));
    if (availP) {
      const match = availP.textContent.match(/(\d+) spots left/);
      if (match) {
        const current = parseInt(match[1], 10);
        const next = Math.max(0, current - 1);
        availP.innerHTML = `<strong>Availability:</strong> ${next} spots left`;
      }
    }

    // If there is a "no participants" placeholder, replace it with a list
    const noneEl = card.querySelector(".participants-none");
    if (noneEl) {
      const ul = document.createElement("ul");
      ul.className = "participants-list";
      const li = buildParticipantListItem(activityName, email);
      ul.appendChild(li);
      noneEl.replaceWith(ul);
      return;
    }

    // Otherwise append to existing list
    const list = card.querySelector(".participants-list");
    if (list) {
      const li = buildParticipantListItem(activityName, email);
      list.appendChild(li);
    }
  }

  function buildParticipantListItem(activityName, email) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "participant-email";
    span.textContent = email;
    const btn = document.createElement("button");
    btn.className = "participant-remove";
    btn.dataset.activity = activityName;
    btn.dataset.email = email;
    btn.setAttribute("aria-label", `Remove ${email}`);
    btn.textContent = "✕";
    btn.addEventListener("click", async () => {
      try {
        const res = await fetch(
          `/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`,
          { method: "DELETE" }
        );
        const result = await res.json();
        if (res.ok) {
          messageDiv.textContent = result.message;
          messageDiv.className = "message success";
          messageDiv.classList.remove("hidden");
          // Remove the li from DOM immediately
          li.remove();
          // Update availability in the card
          const card = btn.closest('.activity-card');
          const availP = Array.from(card.querySelectorAll("p")).find((p) => p.textContent.includes("Availability:"));
          if (availP) {
            const match = availP.textContent.match(/(\d+) spots left/);
            if (match) {
              const current = parseInt(match[1], 10);
              const next = current + 1;
              availP.innerHTML = `<strong>Availability:</strong> ${next} spots left`;
            }
          }
        } else {
          messageDiv.textContent = result.detail || "Failed to remove participant";
          messageDiv.className = "message error";
          messageDiv.classList.remove("hidden");
        }
        setTimeout(() => messageDiv.classList.add("hidden"), 4000);
      } catch (err) {
        console.error("Error removing participant:", err);
      }
    });
    li.appendChild(span);
    li.appendChild(btn);
    return li;
  }
});
