// Older application links used the homepage for demos, shortcuts and email sign-in.
const query = new URLSearchParams(location.search);
let destination;
if (query.get('mode') === 'signIn' && query.has('oobCode')) {
  destination = '/signin';
} else if (query.get('demo') === '1' || ['add-expense', 'view-budget'].includes(query.get('action'))) {
  destination = '/app';
}
if (destination) location.replace(destination + location.search + location.hash);
