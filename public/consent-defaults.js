// Google Consent Mode v2 defaults. Must load (synchronously) BEFORE adsbygoogle.js.
// Until the visitor chooses, ads run without personalization; a stored choice is applied right away.
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = gtag;
(function () {
  var choice = null;
  try { choice = JSON.parse(localStorage.getItem('hakise.consent.v1') || 'null'); } catch (e) { /* storage blocked */ }
  var ads = choice && choice.ads === 'granted' ? 'granted' : 'denied';
  gtag('consent', 'default', { ad_storage: ads, ad_user_data: ads, ad_personalization: ads, analytics_storage: 'denied', wait_for_update: 500 });
  if (ads === 'denied') (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1;
})();
