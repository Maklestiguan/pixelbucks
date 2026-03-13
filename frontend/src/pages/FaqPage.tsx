const FAQS = [
  {
    q: "What is PixelBucks?",
    a: "PixelBucks is a social fake-money betting platform for Dota 2 and CS2 esports. No real money is involved — it's a fun playground to bet on cybersport matches with friends using our virtual currency, PixelBucks (PB).",
  },
  {
    q: "How do I get PixelBucks?",
    a: "You start with 1,000.00 PB when you register. Every week you receive an automatic top-up of 500.00 PB. You can also earn PB by completing daily and weekly challenges.",
  },
  {
    q: "How do I place a bet?",
    a: "Go to the Events page, find an upcoming match, and click on it to expand. Pick a team, enter your stake amount in PB, and hit Place Bet. Your potential payout is shown before you confirm. Bets are locked once the match goes live (unless an admin opens a live betting window).",
  },
  {
    q: "What are the bet limits?",
    a: "There is a global default max bet per event. Admins can adjust the limit for individual events. Your total bets on a single event cannot exceed that event's max bet limit.",
  },
  {
    q: "How are odds determined?",
    a: "Odds are sourced from PandaScore when available. If odds aren't provided, they default to 1.90 / 1.90. Admins can manually adjust odds for any event.",
  },
  {
    q: "What happens if a match ends in a draw?",
    a: "Draw results are treated as a cancelled event. All pending bets on that match are fully refunded to your balance.",
  },
  {
    q: "How is payout calculated?",
    a: "Payout = your stake × odds at the time you placed the bet. For example, a 10.00 PB bet at 2.50 odds returns 25.00 PB total (15.00 PB profit + your 10.00 PB stake).",
  },
  {
    q: "Can I watch matches live?",
    a: "Yes! If a match has streams available, you'll see a Watch button on the event card. Click it and choose a stream — it opens in a persistent player at the top of the Events page.",
  },
  {
    q: "What are Challenges?",
    a: "Challenges are daily and weekly tasks that reward you with extra PB. Examples: place 3 bets today, win a bet, wager 500 PB this week. Check the Challenges page to see what's active.",
  },
  {
    q: "How does the Leaderboard work?",
    a: "The Leaderboard ranks players by all-time profit. Only users with public stats are shown. You can toggle your stats visibility in your Profile page.",
  },
  {
    q: "How do I contact the team or report a bug?",
    a: "Use the Feedback page to share your thoughts, report bugs, or suggest features. You can submit up to 3 feedback entries per week (max 500 characters each). You can also reach out via the in-app Chat.",
  },
  {
    q: "Is this real gambling?",
    a: "No. PixelBucks has no real monetary value. This is purely for entertainment and learning. No real money is wagered, won, or lost.",
  },
];

export function FaqPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">FAQ</h1>
      <p className="text-gray-400 text-sm mb-6">
        Everything you need to know about PixelBucks.
      </p>

      <div className="space-y-4">
        {FAQS.map((faq, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium text-white mb-2">{faq.q}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
