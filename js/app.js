// START APLIKASI
   
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "customer") {
    setupCustomer();
  }

  if (page === "admin") {
    setupAdmin();
  }
});
