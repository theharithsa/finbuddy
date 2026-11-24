"""Shared navigation, compatibility addresses and error views for FinBuddy's public site."""
from html import escape

APP_ORIGIN = 'https://finbuddy-2025.web.app'

# These addresses appeared in previously published help and developer guides.
LEGACY = {
    'docs/getting-started.html': 'docs/product.html#create-account',
    'docs/expense-tracking.html': 'docs/product.html#log-your-first-expense',
    'docs/budget-management.html': 'docs/product.html#see-how-spending-fits-your-plan',
    'docs/analytics.html': 'docs/product.html#see-how-spending-fits-your-plan',
    'docs/app-categorization.html': 'docs/product.html#categories-and-people',
    'docs/achievements.html': 'docs/feature-availability.html#earlier-features',
    'docs/enhanced-monitoring.html': 'docs/privacy-policy.html#usage-analytics',
    'docs/metrics-explorer-guide.html': 'docs/feature-availability.html#metrics-explorer',
    'docs/kautilyaai-guide.html': 'docs/feature-availability.html#kautilya',
    'docs/release-notes.html': 'docs/releases.html',
    'developer/index.html': 'docs/technical.html',
    'developer/api-reference.html': 'docs/technical.html#rest-api',
    'developer/architecture.html': 'docs/technical.html#account-and-storage',
    'developer/analytics.html': 'docs/technical.html#observability-and-release-boundaries',
    'developer/components.html': 'docs/technical.html#web-components',
    'developer/deployment.html': 'docs/pipeline.html',
    'developer/firebase.html': 'docs/technical.html#firebase-environments',
    'developer/hooks.html': 'docs/technical.html#web-components',
    'developer/kautilyaai.html': 'docs/feature-availability.html#kautilya',
    'developer/kautilyaai-copilot.html': 'docs/feature-availability.html#kautilya',
    'developer/pwa.html': 'docs/mobile.html',
    'developer/testing.html': 'docs/technical.html#run-emulator-tests',
    'developer/troubleshooting.html': 'docs/technical.html#developer-troubleshooting',
    'developer/types.html': 'docs/technical.html#money-and-dates',
}

ERRORS = {
    404: ('Page not found', 'Buddy lost the trail.', 'This address may have changed, or the link may have been copied incorrectly. Start at the homepage or find the task you came for in Help.'),
    500: ('Something went wrong', 'Time for a fresh start.', 'FinBuddy couldn’t finish opening this view. Open the workspace again. If you were saving an entry, check the ledger before adding it a second time.'),
    501: ('Not implemented', 'That path isn’t built yet.', 'The service doesn’t support the requested operation. Check which features are available or look up the supported operations in the API guide.'),
    503: ('Service unavailable', 'A short pause on the trail.', 'The service is temporarily unavailable. Wait a moment and try again. If a save was interrupted, check your entries before repeating it.'),
}


def header(prefix, app):
    return f'''<header class="header wrap">
    <a class="wordmark" href="{prefix}index.html" aria-label="FinBuddy home"><span class="mark" aria-hidden="true"></span>FinBuddy</a>
    <nav aria-label="Main"><a href="{prefix}index.html#tour">Product tour</a><a href="{prefix}docs/index.html">Help center</a><a href="{prefix}docs/roadmap.html">Roadmap</a><a class="button small primary" href="{app}signin">Sign in</a></nav>
  </header>'''


def footer(prefix):
    return f'''<footer class="footer wrap"><a class="wordmark" href="{prefix}index.html"><span class="mark" aria-hidden="true"></span>FinBuddy</a>
    <nav aria-label="Footer"><a href="{prefix}docs/index.html">Help center</a><a href="{prefix}docs/privacy-policy.html">Privacy</a><a href="{prefix}docs/terms-and-conditions.html">Terms</a><a href="{prefix}docs/security.html">Security</a><a href="https://github.com/theharithsa/finbuddy">Source code</a></nav>
  </footer>'''


def document(title, description, prefix, app, content, extra_head=''):
    return f'''<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} | FinBuddy</title><meta name="description" content="{escape(description)}">
<meta name="theme-color" content="#f9f7f1"><link rel="icon" type="image/png" href="{prefix}media/buddy-mark-v2.png">
<link rel="stylesheet" href="{prefix}landing.css"><link rel="stylesheet" href="{prefix}guides.css">{extra_head}</head>
<body><a class="skip" href="#main">Skip to content</a>{header(prefix, app)}{content}{footer(prefix)}</body></html>
'''


def error_page(code, prefix, app):
    status, title, description = ERRORS[code]
    actions = {
        404: (prefix + 'index.html', 'FinBuddy home', prefix + 'docs/index.html', 'Find a guide'),
        500: (app + 'app', 'Reopen workspace', prefix + 'docs/troubleshooting.html', 'Troubleshoot'),
        501: (prefix + 'docs/feature-availability.html', 'Available features', prefix + 'docs/technical.html#rest-api', 'Check the API guide'),
        503: (app + 'app', 'Try the workspace again', prefix + 'docs/troubleshooting.html', 'Troubleshoot'),
    }
    primary, label, secondary, other = actions[code]
    content = f'''<main id="main" tabindex="-1" class="wrap error-layout"><div class="error-copy" id="error-{code}">
    <p class="eyebrow">{code} / {status}</p><h1>{title}</h1><p class="lead">{description}</p>
    <div class="actions"><a class="button primary" href="{primary}">{label}</a><a class="text-link" href="{secondary}">{other}</a></div>
    </div><div class="trail-map" aria-hidden="true"><span class="trail"></span><span class="trail-end">×</span><span class="trail-buddy"></span></div></main>'''
    return document(status, description, prefix, app, content, '<meta name="robots" content="noindex">')


def moved_page(target, prefix, app):
    dest = escape(prefix + target)
    # A plain link and a no-script refresh also work with JavaScript disabled.
    content = f'''<main id="main" tabindex="-1" class="wrap moved"><h1>This guide has moved.</h1><p><a class="text-link" id="guide-destination" href="{dest}">Continue to the current guide</a></p></main>'''
    return document('Guide moved', 'Continue to the current FinBuddy guide.', prefix, app, content,
                    f'<meta name="robots" content="noindex"><noscript><meta http-equiv="refresh" content="0; url={dest}"></noscript><script defer src="{prefix}guide-redirect.js"></script>')
