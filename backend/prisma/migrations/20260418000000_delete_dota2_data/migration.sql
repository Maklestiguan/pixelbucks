-- Delete all Dota 2 tournaments, events, and their bets.

DELETE FROM bets
WHERE event_id IN (SELECT id FROM events WHERE game = 'dota2');

DELETE FROM events WHERE game = 'dota2';

DELETE FROM tournaments WHERE game = 'dota2';
