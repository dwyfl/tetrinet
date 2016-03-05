import optimist from 'optimist'
import express from 'express'
import {createServer} from 'http'
import socketio from 'socket.io'
import Game from './game'
import Room from './room'

const app = express()
const server = createServer(app)
const io = socketio(server)
// const game = new Game(io)

app.use(express.static(__dirname + '/../build'))

import Baobab from 'baobab'
const tree = new Baobab({
  time: Date.now(),
  rooms: {},
})

const rooms = {}
let roomId = 0
function addRoom(options) {
  const id = ++roomId
  const cursor = tree.select(['rooms', id])
  rooms[id] = new Room(cursor, options)
  return rooms[id]
}

addRoom({name: 'a'})

tree.on('update', ({data}) => {
  // console.dir(data, {depth:5})
  io.emit('update', data.transaction)
})

io.on('connection', socket => {
  console.log('Client connected!')
  socket.emit('init', tree.get())
  const player = rooms[1].join(socket, {name: 'Jesper'})
  socket.emit('self', player.cursor.path)
})

setInterval(() => tree.set('time', Date.now()), 1000)

const port = process.env.PORT || 1080
server.listen(port, () => {
  console.log('Server listening at port', port)
})
