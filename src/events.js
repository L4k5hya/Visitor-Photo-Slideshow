class EventHub {
  constructor() {
    this.clients = new Set();
    // Heartbeat keeps proxies/TVs from closing an idle connection
    this.timer = setInterval(() => {
      for (const c of this.clients) c.write(': ping\n\n');
    }, 25000);
    this.timer.unref();
  }

  handler() {
    return (req, res) => {
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.flushHeaders();
      res.write('retry: 3000\n\n');
      this.clients.add(res);
      req.on('close', () => this.clients.delete(res));
    };
  }

  broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(msg);
  }
}

module.exports = { EventHub };