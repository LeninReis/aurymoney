import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use(express.static(join(__dirname, '../dist')))

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages,
    })
    res.json({ text: response.content[0].text })
  } catch (err) {
    console.error('Erro:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
