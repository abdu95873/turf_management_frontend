import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function scrollWindowAndDashboardToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const dashboardContent = document.querySelector(".dashboard-content");
  if (dashboardContent) {
    dashboardContent.scrollTop = 0;
  }
}

/** Scroll to top on route change; honor hash anchors (e.g. /#venues). */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, "");
      if (!id) {
        scrollWindowAndDashboardToTop();
        return;
      }
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      });
      return;
    }

    scrollWindowAndDashboardToTop();
  }, [pathname, hash]);

  return null;
}
