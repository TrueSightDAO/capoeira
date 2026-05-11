/**
 * capoeira-checkout.js — Stripe checkout integration via Edgar API
 * 
 * Architecture:
 * - Calls Edgar checkout endpoint: https://edgar.truesight.me/api/checkout
 * - Handles donation amounts with proper Stripe integration
 * - Supports capoeira-specific metadata (project: "capoeira-donations")
 * - Provides user-friendly error handling and loading states
 * - Redirects to Stripe Checkout URL on success
 * 
 * Production description: Integrates Stripe donation checkout via Edgar API for capoeira donations with proper error handling and loading states
 */

(function() {
    'use strict';

    const EDGAR_API_BASE = 'https://edgar.truesight.me/api';
    const CHECKOUT_ENDPOINT = `${EDGAR_API_BASE}/checkout`;

    /**
     * Initialize donation amount selector
     */
    let selectedAmount = 50;

    function selectAmount(amount, btn) {
        selectedAmount = amount;
        document.querySelectorAll('.donate-amount').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('selected-amount').textContent = amount;
    }

    /**
     * Call Edgar API to create Stripe checkout session
     */
    async function initiateCapoeiraCheckout() {
        const btn = document.getElementById('stripe-donate-btn');
        const errorContainer = document.getElementById('checkout-errors');
        
        // Reset error display
        errorContainer.style.display = 'none';
        errorContainer.innerHTML = '';

        // Update UI to loading state
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            const response = await fetch(CHECKOUT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'createCheckoutSession',
                    amount: selectedAmount,
                    currency: 'usd',
                    metadata: {
                        project: 'capoeira-donations',
                        source: 'capoeira.agroverse.shop'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Edgar API returned status ${response.status}`);
            }

            const data = await response.json();

            if (data.status !== 'success') {
                throw new Error(data.error || 'Checkout session creation failed');
            }

            // Success - redirect to Stripe Checkout URL
            if (data.stripe_checkout_url) {
                window.location.href = data.stripe_checkout_url;
            } else {
                throw new Error('No Stripe checkout URL returned from Edgar API');
            }

        } catch (error) {
            console.error('Checkout error:', error);
            
            // Show user-friendly error message
            errorContainer.style.display = 'block';
            errorContainer.innerHTML = `
                <div style="background: #fee; color: #c33; padding: 0.75rem; border-radius: 5px; margin-bottom: 1rem;">
                    <strong style="display: block; margin-bottom: 0.5rem;">Checkout Error</strong>
                    <p style="margin: 0;">${error.message}</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">
                        <em>Please try again or contact support if the issue persists.</em>
                    </p>
                </div>
            `;

            // Reset button state
            btn.disabled = false;
            btn.textContent = `Donate $${selectedAmount}`;
        }
    }

    /**
     * Initialize on page load
     */
    window.addEventListener('DOMContentLoaded', function() {
        const donateBtn = document.getElementById('stripe-donate-btn');
        if (donateBtn) {
            donateBtn.addEventListener('click', initiateCapoeiraCheckout);
        }
    });

    /**
     * Make checkout function available globally for onclick handlers
     */
    window.initiateCapoeiraCheckout = initiateCapoeiraCheckout;
    window.selectAmount = selectAmount;
})();