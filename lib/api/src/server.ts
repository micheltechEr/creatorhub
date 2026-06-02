const express = require('express');
import artistRouter from './routes/artist';

const app = express();
app.use(express.json());

// Register artist routes
app.use('/artists', artistRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

export default app;