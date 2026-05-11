/**
 * capoeira-checkout.js — Stripe checkout integration via the agroverse_shop
 * Google Apps Script (`createLedgerCheckoutSession` action).
 *
 * Architecture (per agentic_ai_context/STRIPE_LEDGER_ROUTING.md Flow 4):
 *
 *   capoeira.agroverse.shop
 *        │  GET .../exec?action=createLedgerCheckoutSession&ledger=TBM&amount=N
 *        ▼
 *   Google Apps Script  ── creates Stripe Checkout Session with line item
 *        │                  product_data.name = "[TBM] — Donation to Tribo Bahia Mirim"
 *        │  returns { checkoutUrl }
 *        ▼
 *   window.location.href = checkoutUrl   →   Stripe-hosted checkout
 *        │
 *        │  user pays (test card 4242 4242 4242 4242 in dev)
 *        ▼
 *   Stripe webhook  →  Edgar /stripe_webhook  →  MetaCheckoutOrderSync
 *        │              (logs to "Stripe Social Media Checkout ID" tab)
 *        ▼
 *   stripe_sales_sync.gs#routeStripeCheckoutPurchasesToLedgers
 *        matches /^\[([A-Z0-9]+)\]/ on the line item → routes to TBM ledger
 *        ▼
 *   snapshot_managed_ledgers.py → treasury-cache/managed-ledgers/TBM.json
 *        ▼
 *   tribomirimbahia.truesight.me renders the new transaction.
 *
 * Same GAS endpoint that agroverse_shop checkout already uses; new action
 * (`createLedgerCheckoutSession`) is the generic ledger-tagged variant.
 * Works for any managed ledger via the [LEDGER_ID] product-name prefix.
 */

(function () {
    'use strict';

    // Shared Apps Script deploy URL (also used by agroverse_shop checkout).
    // Source of truth: agroverse_shop/js/config.js → GOOGLE_SCRIPT_URL.
    var GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyefqjQNwegrXR9y18HyJMxSM2wWCyucsK5qdh5isJICVhonssajEpT4Dt3hq3A7PTA/exec';

    var LEDGER_ID = 'TBM';
    var DESCRIPTION = 'Donation to Tribo Bahia Mirim';

    // Stripe test mode when hosted locally, live mode in production.
    var hostname = (window.location && window.location.hostname) || '';
    var isLocal = ['localhost', '127.0.0.1', '0.0.0.0', ''].indexOf(hostname) !== -1;
    var ENVIRONMENT = isLocal ? 'development' : 'production';

    var selectedAmount = 50;

    function selectAmount(amount, btn) {
        selectedAmount = amount;
        document.querySelectorAll('.donate-amount').forEach(function (b) {
            b.classList.remove('selected');
        });
        if (btn) btn.classList.add('selected');
        var label = document.getElementById('selected-amount');
        if (label) label.textContent = amount;
    }

    /**
     * Build absolute success / cancel URLs anchored on whatever origin the
     * page is currently served from (works for localhost dev + prod).
     */
    function buildReturnUrls() {
        var origin = window.location.origin || ('http://' + hostname);
        var path = window.location.pathname.replace(/[^/]+$/, '') || '/';
        // `{CHECKOUT_SESSION_ID}` is filled in by Stripe before redirect.
        return {
            success_url: origin + path + '?donation=success&session_id={CHECKOUT_SESSION_ID}',
            cancel_url:  origin + path + '#donate'
        };
    }

    async function initiateCapoeiraCheckout() {
        var btn = document.getElementById('stripe-donate-btn');
        var errorContainer = document.getElementById('checkout-errors');

        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.innerHTML = '';
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processing...';
        }

        try {
            var urls = buildReturnUrls();
            var params = new URLSearchParams({
                action: 'createLedgerCheckoutSession',
                ledger: LEDGER_ID,
                amount: String(selectedAmount),
                currency: 'usd',
                description: DESCRIPTION,
                environment: ENVIRONMENT,
                source: 'capoeira.agroverse.shop',
                success_url: urls.success_url,
                cancel_url: urls.cancel_url
            });

            // GET (matches agroverse_shop pattern, no CORS preflight).
            var response = await fetch(GOOGLE_SCRIPT_URL + '?' + params.toString(), {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Checkout endpoint returned status ' + response.status);
            }

            var data = await response.json();

            if (data.status !== 'success') {
                throw new Error(data.error || 'Checkout session creation failed');
            }

            if (!data.checkoutUrl) {
                throw new Error('No Stripe checkout URL returned');
            }

            window.location.href = data.checkoutUrl;
        } catch (error) {
            console.error('Checkout error:', error);

            if (errorContainer) {
                errorContainer.style.display = 'block';
                errorContainer.innerHTML =
                    '<div style="background:#fee;color:#c33;padding:0.75rem;border-radius:5px;margin-bottom:1rem;">'
                  + '<strong style="display:block;margin-bottom:0.5rem;">Checkout Error</strong>'
                  + '<p style="margin:0;">' + (error.message || String(error)) + '</p>'
                  + '<p style="font-size:0.9rem;margin-top:0.5rem;"><em>Please try again or contact support if the issue persists.</em></p>'
                  + '</div>';
            }

            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Donate $' + selectedAmount;
            }
        }
    }

    window.addEventListener('DOMContentLoaded', function () {
        var donateBtn = document.getElementById('stripe-donate-btn');
        if (donateBtn) {
            donateBtn.addEventListener('click', initiateCapoeiraCheckout);
        }
    });

    window.initiateCapoeiraCheckout = initiateCapoeiraCheckout;
    window.selectAmount = selectAmount;
})();
