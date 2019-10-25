import express from 'express';
import db from '../utils/db';
const router = express.Router();


router.post('/', async (req, res) => {
  try {
    const { dbUrl, dbName } = req.body;
    const { dbo } = await db.connect(dbUrl, dbName);
    const collections = await dbo.collections();

    res.status(200).json({
      success: true,
      collections: collections.map(a => ({ name: a.collectionName }))
    })

  } catch (error) {
    res.status(501).send(error.message);
  }
})

export default router;