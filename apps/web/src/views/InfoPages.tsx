import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtNum, STAKING_APR_PCT, TIERS } from '@apogee/shared';
import { IconOrbit, IconRocket, IconWallet } from '../components/icons';

/* ── Shared page frame ────────────────────────────────────────────── */

function InfoShell({ title, updated, children }: { title: string; updated?: boolean; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-[24px] font-semibold tracking-tight text-ivory">{title}</h1>
      {updated && <p className="label mt-2">Last updated · July 2026</p>}
      <div className="panel mt-5 flex flex-col gap-5 p-7 text-[13.5px] leading-relaxed text-muted max-[640px]:p-5">
        {children}
      </div>
    </article>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="-mb-2 text-[15px] font-semibold text-ivory">{children}</h2>;
}

const LEGAL_NOTE =
  'This document is a template provided with the Phase 1 preview and does not constitute legal advice. Have qualified counsel review and localize it before accepting real funds.';

/* ── How it works ─────────────────────────────────────────────────── */

export function HowItWorks() {
  const steps = [
    {
      icon: IconWallet,
      title: '1 · Connect & verify',
      body: 'Connect Phantom, MetaMask or Coinbase Wallet and sign a one-time message. No transaction, no fees — the signature only proves you own the address.',
    },
    {
      icon: IconOrbit,
      title: '2 · Stake APG for a tier',
      body: `Stake APG to enter an orbit. Your tier sets your allocation weight, maximum buy and participation fee across every launch. Snapshots run daily at 00:00 UTC, and staking earns ${STAKING_APR_PCT}% APR.`,
    },
    {
      icon: IconRocket,
      title: '3 · Buy, then claim as it vests',
      body: 'Participate in live sales with USDC. Tokens unlock at TGE and vest linearly after the cliff — claim from your portfolio any time, as often as you like.',
    },
  ];

  const faqs: [string, string][] = [
    [
      'What does "Phase 1 preview" mean?',
      'Wallet connections and signatures are real, but balances, staking and purchases are simulated off-chain while the sale, staking and vesting contracts are audited. No real funds move in Phase 1.',
    ],
    [
      'How does the IGNITION lottery work?',
      'IGNITION buys enter an allocation lottery drawn when the sale closes. Higher tiers (ORBIT and above) have guaranteed allocation up to their max buy.',
    ],
    [
      'When can I claim my tokens?',
      'Each sale sets a TGE unlock percentage, a cliff, and a linear vesting period — you can see all three on the sale page before you buy. Claimable tokens accrue continuously once vesting starts.',
    ],
    [
      'Can I unstake at any time?',
      'Yes. Unstaking is instant, but your tier drops immediately and applies to any sale you participate in afterwards.',
    ],
    [
      'Which chains are supported?',
      'Sales launch on Solana, Ethereum, Base and BNB Chain. Your tier follows your account across all of them.',
    ],
    [
      'How do projects get listed?',
      'Teams apply through the Apply for Launch form. We review the product, team, tokenomics and audit status before scheduling a sale.',
    ],
  ];

  return (
    <InfoShell title="How Apogee works">
      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {steps.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-line bg-panel2 p-4">
            <Icon size={18} className="text-gold" />
            <h3 className="mt-2.5 text-[13.5px] font-semibold text-ivory">{title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <H>Tiers</H>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[480px]">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Stake</th>
              <th>Allocation</th>
              <th>Max buy</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.key}>
                <td className="num text-ivory">{t.name}</td>
                <td className="num">{fmtNum(t.minStake)} APG</td>
                <td className="num">{t.multiplier}</td>
                <td className="num">${fmtNum(t.maxBuyUsd)}</td>
                <td className="num">{t.feePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>FAQ</H>
      <div className="flex flex-col gap-2">
        {faqs.map(([q, a]) => (
          <details key={q} className="group rounded-xl border border-line bg-panel2 px-4 py-3">
            <summary className="cursor-pointer list-none text-[13px] font-medium text-ivory">
              {q}
            </summary>
            <p className="mt-2 text-[12.5px] leading-relaxed">{a}</p>
          </details>
        ))}
      </div>

      <p>
        Ready to launch with us?{' '}
        <Link to="/apply" className="text-gold hover:underline">
          Apply for Launch →
        </Link>
      </p>
    </InfoShell>
  );
}

/* ── Terms ────────────────────────────────────────────────────────── */

export function Terms() {
  return (
    <InfoShell title="Terms of Service" updated>
      <p className="rounded-xl border border-gold/25 bg-gold/5 p-3.5 text-[12px]">{LEGAL_NOTE}</p>
      <H>1 · The service</H>
      <p>
        Apogee provides a platform for discovering token launches and, in Phase 1, a simulated
        participation environment. Access to the interface does not constitute an offer of
        securities, investment advice, or a solicitation to invest in any jurisdiction.
      </p>
      <H>2 · Eligibility</H>
      <p>
        You must be of legal age in your jurisdiction and must not be a resident of, or access the
        service from, any jurisdiction where participation in token sales is restricted or
        prohibited. You are solely responsible for compliance with your local laws, including tax
        obligations.
      </p>
      <H>3 · Wallets & security</H>
      <p>
        You retain sole custody of your wallets and keys. Signing the sign-in message proves
        address ownership and never authorizes fund movement. We will never ask for your seed
        phrase.
      </p>
      <H>4 · No guarantees</H>
      <p>
        Projects listed on Apogee are independent third parties. Listing does not imply
        endorsement. Token values may go to zero. Past ROI figures are historical and are not
        indicative of future results.
      </p>
      <H>5 · Prohibited use</H>
      <p>
        Market manipulation, use of exploits or automation to gain unfair allocation, sybil
        participation across multiple wallets, and any unlawful activity are prohibited and may
        result in disqualification of allocations.
      </p>
      <H>6 · Limitation of liability</H>
      <p>
        The service is provided “as is” without warranties. To the maximum extent permitted by
        law, Apogee and its contributors are not liable for any loss arising from use of the
        service, including loss of funds, data, or profits.
      </p>
    </InfoShell>
  );
}

/* ── Privacy ──────────────────────────────────────────────────────── */

export function Privacy() {
  return (
    <InfoShell title="Privacy Policy" updated>
      <p className="rounded-xl border border-gold/25 bg-gold/5 p-3.5 text-[12px]">{LEGAL_NOTE}</p>
      <H>What we collect</H>
      <p>
        Wallet addresses you connect, signatures used for authentication, participation and
        staking records, and launch-application details you submit. We do not collect names,
        emails (except in launch applications), or browsing profiles, and we do not use
        third-party advertising trackers.
      </p>
      <H>How it’s used</H>
      <p>
        To operate the launchpad: computing tiers, enforcing sale limits, showing your portfolio,
        and displaying anonymized activity (addresses are always truncated in public feeds).
        Launch-application details are used solely to evaluate the application.
      </p>
      <H>Storage & retention</H>
      <p>
        Records are stored in our database for as long as needed to operate the service.
        Session tokens expire after 2 hours and are stored only in your browser.
      </p>
      <H>Your rights</H>
      <p>
        Wallet addresses are pseudonymous public-chain identifiers. To request deletion of
        off-chain records associated with your address, contact the team through official
        channels listed on the site.
      </p>
    </InfoShell>
  );
}

/* ── Risk disclaimer ──────────────────────────────────────────────── */

export function Risk() {
  return (
    <InfoShell title="Risk Disclosure" updated>
      <p className="rounded-xl border border-red/30 bg-red/5 p-3.5 text-[12px] text-ivory">
        Participating in token sales is highly speculative. Do not commit funds you cannot afford
        to lose entirely.
      </p>
      <H>Market risk</H>
      <p>
        Token prices are extremely volatile. Listing prices, ROI and ATH figures shown on ended
        sales are historical snapshots and can reverse at any time.
      </p>
      <H>Project risk</H>
      <p>
        Early-stage projects can fail: teams may not deliver, audits do not eliminate smart-contract
        risk, and vesting schedules mean your allocation stays exposed to price changes before it
        unlocks.
      </p>
      <H>Technology risk</H>
      <p>
        Blockchains, bridges, wallets and this platform can contain defects. Phase 1 operates
        off-chain precisely so these mechanisms can be hardened before real funds are involved.
      </p>
      <H>Regulatory risk</H>
      <p>
        Token sale regulation varies by jurisdiction and changes quickly. You are responsible for
        determining whether participation is lawful where you live.
      </p>
    </InfoShell>
  );
}
