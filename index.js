import OpenAI from 'openai'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from 'dotenv'
import { todosTable } from './schema.js'
import readline from 'readline'

config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com/v1'
})

const sql = postgres(process.env.DATABASE_URL)
const db = drizzle(sql)

const tools = {
  getAllTodos: async () => {
    return await db.select().from(todosTable)
  },

  createTodo: async (content) => {
    const result = await db.insert(todosTable).values({ content }).returning()
    return result[0]
  },

  deleteTodoById: async (id) => {
    await db.delete(todosTable).where(eq(todosTable.id, id))
    return true
  },

  searchTodos: async (query) => {
    return await db.select().from(todosTable).where(ilike(todosTable.content, `%${query}%`))
  }
}

async function makeAIRequest(messages) {
  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature: 0.7,
    max_tokens: 1000
  })
  return completion.choices[0].message
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function main() {
  const context = [
    { role: 'system', content: 'You are a todo list manager. Help users manage their tasks.' }
  ]

  while (true) {
    const input = await new Promise(resolve => rl.question('> ', resolve))
    
    if (input.toLowerCase() === 'exit') {
      rl.close()
      process.exit(0)
    }

    context.push({ role: 'user', content: input })
    const response = await makeAIRequest(context)
    context.push(response)
    
    if (response.content) {
      console.log(response.content)
    }
  }
}

main()