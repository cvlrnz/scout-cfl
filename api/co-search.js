export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers['x-co-token'];
  if (!token) return res.status(401).json({ error: 'Missing ContactOut token' });
  try {
    const response = await fetch('https://api.contactout.com/v1/people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'token': token },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
