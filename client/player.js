import $ from 'jquery'
import Board from './board'
import Block from './block'
import Timer from './timer'

function prng(seed) {
	return {
		uint32(min = 0, max = 100000) {
			return Math.floor(Math.random() * (max - min)) + min;
		}
	}
}

class Player extends Board {
    constructor() {
        super();
        this.reset();

        this.dropTimer = new Timer(Player.DROP_DELAY);
        this.dropTimer.on(Timer.EVENT_TIMER, () => { this.drop(); });

        this.newBlockTimer = new Timer(Player.NEWBLOCK_DELAY, 1);
        this.newBlockTimer.on(Timer.EVENT_TIMER, () => { this.doCreateNewBlock(); });

        this.flipTimer = new Timer(Player.TIME_FLIP, 1);
        this.flipTimer.on(Timer.EVENT_TIMER, () => { this.flip = false; });

        this.invisibleTimer = new Timer(Player.TIME_INVISIBLE, 1);
        this.invisibleTimer.on(Timer.EVENT_TIMER, () => { this.invisible = false; });

        this.reflectTimer = new Timer(Player.TIME_REFLECT, 1);
        this.reflectTimer.on(Timer.EVENT_TIMER, () => { this.reflect = false; });

        this.speedTimer = new Timer(Player.TIME_SPEED, 1);
        this.speedTimer.on(
            Timer.EVENT_TIMER,
            () => { this.speed = false; $('body').removeClass('speed'); }
        );
    }

    reset(seed) {
        this.currentBlock = null;
        this.holdBlock = null;
        this.nextBlocks = [];
        this.ghostBlock = null;
        this.numLines = 0;
        this.numBlocks = 0;
        this.combo = 0;

        this.dropStick = 0;
        this.random = seed ? prng(seed) : prng();
        this.inventory = [];
        this.zebra = false;
        this.flip = false;
        this.reflect = false;
        this.invisible = false;
        this.speed = false;
        this.isPlaying = false;
        this.rickroll = 0;
        this.holdPossible = true;
    }

    setOptions(options) {
        this.options = options;
        this.newBlockTimer.delay = options.entrydelay;
    }

    start(seed) {
        this.reset(seed);
        this.clear();
        this.isPlaying = true;

        this.generateBlocks();
        this.createNewBlock();

        this.emit(Board.EVENT_CHANGE);
        this.emit(Player.EVENT_INVENTORY);
    }

    stop() {
        this.dropTimer.stop();
        this.newBlockTimer.stop();
        this.emit(Board.EVENT_UPDATE);
    }

    updateGhostBlock() {
        this.ghostBlock = null;
        if(this.currentBlock) {
            this.ghostBlock = new Block(0,0);
            for(let key in this.currentBlock)
                this.ghostBlock[key] = this.currentBlock[key];
            while(!this.collide(this.ghostBlock))
                ++this.ghostBlock.y;
            --this.ghostBlock.y;
        }
    }

    at(x, y) {
        if(this.currentBlock && this.currentBlock.hasPieceAt(x,y))
            return this.currentBlock.type + 1;
        if(this.ghostBlock && this.ghostBlock.hasPieceAt(x,y))
            return 10;
        if(this.invisible) {
            if(this.inBlockVisinity(x,y))
                return this.data[y * this.width + x];
            return 9;
        }
        return this.data[y * this.width + x];
    }

    inBlockVisinity(x, y) {
        if (this.currentBlock) {
            let bx, by;
            for (let i = 0; i < this.currentBlock.data.length; ++i) {
                bx = this.currentBlock.x + this.currentBlock.data[i][0];
                by = this.currentBlock.y + this.currentBlock.data[i][1];
                if (Math.abs(x-bx) <= 4 && Math.abs(y-by) <= 4)
                    return true;
            }
        }
        return false;
    }

    addLines(numLines) {
        super.addLines(numLines);
        if(this.currentBlock) {
            const bb = this.currentBlock.getBoundingBox(), blockHeight = Math.abs(bb.maxy - bb.miny);
            this.currentBlock.y = Math.max(-blockHeight, this.currentBlock.y - numLines);
        }
        this.emit(Board.EVENT_CHANGE);
    }

    putBlock(block) {
        this.holdPossible = true;
        super.putBlock(block);
    }

    onRemoveLines(lines, data) {

        this.combo = lines > 0 ? this.combo + 1 : 0;
        this.numLines += lines;

        super.onRemoveLines(lines, data);

        if(!this.options.specials)
            return;

        let i, l;
        for(i=0; i<data.length; ++i) {
            // add removed specials to inventory
            if(typeof data[i] === 'string') {
                for(l = 0; l < lines && this.inventory.length < Player.INVENTORY_MAX; ++l) {
                    const p = this.inventory.length == 0 ? 0 : 1 + Math.floor((this.inventory.length - 1) * Math.random());
                    this.inventory.splice(p, 0, data[i]);
                }
            }
        }

        // attempt to add new specials
        const b = []; // b contains occupied blocks
        for(i = 0; i < this.data.length; ++i) {
            if(this.data[i] > 0)
                b.push(i);
        }

        l = lines;
        while(b.length && l) {
            i = Math.floor(b.length * Math.random());
            this.data[b[i]] = Special.getRandomSpecial();
            b.splice(i, 1);
            l--;
        }

        this.emit(Player.EVENT_INVENTORY);
    }

    drop() {
        if(this.move(0,1,0,this.dropStick == 5)) {
            ++this.dropStick;
        }
        else
            this.emit(Player.EVENT_DROP);
    }

    initDrop() {
        if(!this.speed)
            this.dropTimer.delay = Math.max(50, 750 - this.numLines * 5);
        this.dropTimer.start();
    }

    generateBlocks() {
        while(this.nextBlocks.length < 3) {
            if(this.options.generator === Player.BLOCK_GENERATOR_RANDOM) {
                this.nextBlocks.push(new Block(this.random.uint32(), 0));
            } else {
                let i;
                const blocks = [];
                for(i = 0; i < Block.blockData.length; ++i)
                    blocks.push(i);
                while(blocks.length)
                    this.nextBlocks.push(new Block(blocks.splice(this.random.uint32() % blocks.length, 1)[0], 0));
            }
        }
    }

    createNewBlock() {
        this.currentBlock = null;
        this.emit(Board.EVENT_CHANGE);
        this.dropTimer.stop();
        this.newBlockTimer.start();
    }

    doCreateNewBlock() {
        this.numBlocks++;
        this.dropStick = 0;
        const newBlock = this.nextBlocks.shift();
        this.generateBlocks();
        this.setCurrentBlock(newBlock);
    }

    setCurrentBlock(block) {
        const bb = block.getBoundingBox();
        const bw = bb.maxx - bb.minx + 1;
        const bh = bb.maxy - bb.miny + 1;
        this.currentBlock = block;
        this.currentBlock.x = Math.floor((this.width - bw) / 2) - bb.minx;
        this.currentBlock.y = Board.VANISH_ZONE_HEIGHT - bb.miny - bh;
        this.emit(Board.EVENT_UPDATE);
        if (this.collide(this.currentBlock)) {
            this.putBlock(this.currentBlock);
            this.currentBlock = null;
            this.isPlaying = false;
            this.emit(Board.EVENT_CHANGE);
            this.emit(Player.EVENT_GAMEOVER);
        } else {
            this.initDrop();
        }
        this.emit(Player.EVENT_NEW_BLOCK);
    }

    hold() {
        if (this.holdPossible && this.currentBlock) {
            this.holdPossible = false;
            if (this.holdBlock) {
                const newBlock = this.holdBlock;
                this.holdBlock = this.currentBlock;
                this.holdBlock.setRotation(0);
                this.setCurrentBlock(newBlock);
            } else {
                this.holdBlock = this.currentBlock;
                this.holdBlock.setRotation(0);
                this.createNewBlock();
            }
        }
    }

    move(x, y, r, stick) {
        if (!this.currentBlock)
            return;
        if (this.flip)
            x *= -1;
        const initialRotation = this.currentBlock.rotation;
        this.currentBlock.x += x;
        this.currentBlock.y += y;
        if (r) {
            this.currentBlock.rotate(r);
        }
        const c = this.collide(this.currentBlock);
        if (c != Board.NO_COLLISION) {
            let rotationSucceeded = false;
            if (x == 0 && y == 0 && r && !stick) {
                switch (this.options.rotationsystem) {
                    case Player.ROTATION_SYSTEM_CLASSIC:
                        rotationSucceeded = this.handleCollisionClassic(c);
                        break;
                    default:
                    case Player.ROTATION_SYSTEM_SRS:
                        rotationSucceeded = this.handleCollisionSRS(initialRotation, r);
                        break;
                }
            }
            if (x == 0 && y == 0 && !stick && rotationSucceeded) {
                this.emit(Board.EVENT_UPDATE);
                return false;
            } else {
                // revert position
                this.currentBlock.x -= x;
                this.currentBlock.y -= y;
                if(r)
                    this.currentBlock.rotate(-r);
                if(stick) {
                    this.putBlock(this.currentBlock);
                    this.createNewBlock();
                }
                return true;
            }
        }
        this.emit(Board.EVENT_UPDATE);
        return false;
    }

    handleCollisionClassic(c) {

        const bb = this.currentBlock.getBoundingBox(), ox = this.currentBlock.x, oy = this.currentBlock.y;

        switch (c) {
            case Board.COLLISION_BOUNDS:
                // collided with floor when rotating?
                for (var i = 0; i < Math.abs(bb.maxy - bb.miny); i++) {
                    this.currentBlock.y--;
                    if (this.collide(this.currentBlock) == Board.NO_COLLISION)
                        return true;
                }
                // collided with wall when rotating?
                this.currentBlock.x = (this.currentBlock.x < (this.width/2)) ? -bb.minx : this.width - bb.maxx - 1;
                if (this.collide(this.currentBlock) == Board.NO_COLLISION)
                    return true;
                break;
            case Board.COLLISION_BLOCKS:
                // collided with floor when rotating?
                for (var i = 0; i < Math.abs(bb.maxy - bb.miny) && this.collide(this.currentBlock); i++)
                    this.currentBlock.y--;
                if (this.collide(this.currentBlock) == Board.NO_COLLISION)
                    return true;
                break;
        }
        this.currentBlock.x = ox;
        this.currentBlock.y = oy;
        return false;
    }

    handleCollisionSRS(initialRotation, r) {

        const TEST_OFFSETS_JLSTZ = [
            [ [-1, 0], [-1,-1], [ 0, 2], [-1, 2] ],	// 0 -> R / 0 -> 1
            [ [ 1, 0], [ 1, 1], [ 0,-2], [ 1,-2] ],	// R -> 2 / 1 -> 2
            [ [ 1, 0], [ 1,-1], [ 0, 2], [ 1, 2] ],	// 2 -> L / 2 -> 3
            [ [-1, 0], [-1, 1], [ 0,-2], [-1,-2] ],	// L -> 0 / 3 -> 0
            [ [ 1, 0], [ 1,-1], [ 0, 2], [ 1, 2] ],	// 0 -> L / 0 -> 3
            [ [ 1, 0], [ 1, 1], [ 0,-2], [ 1,-2] ],	// R -> 0 / 1 -> 0
            [ [-1, 0], [-1,-1], [ 0, 2], [-1, 2] ],	// 2 -> R / 2 -> 1
            [ [-1, 0], [-1, 1], [ 0,-2], [-1,-2] ] 	// L -> 2 / 3 -> 2
        ];
        const TEST_OFFSETS_I = [
            [ [-2, 0], [ 1, 0], [-2, 1], [ 1,-2] ],	// 0 -> R / 0 -> 1
            [ [-1, 0], [ 2, 0], [-1,-2], [ 2, 1] ],	// R -> 2 / 1 -> 2
            [ [ 2, 0], [-1, 0], [ 2,-1], [-1, 2] ],	// 2 -> L / 2 -> 3
            [ [ 1, 0], [-2, 0], [ 1, 2], [-2,-1] ],	// L -> 0 / 3 -> 0
            [ [-1, 0], [ 2, 0], [-1,-2], [ 2, 1] ],	// 0 -> L / 0 -> 3
            [ [ 2, 0], [-1, 0], [ 2,-1], [-1, 2] ],	// R -> 0 / 1 -> 0
            [ [ 1, 0], [-2, 0], [ 1, 2], [-2,-1] ],	// 2 -> R / 2 -> 1
            [ [-2, 0], [ 1, 0], [-2, 1], [ 1,-2] ] 	// L -> 2 / 3 -> 2
        ];
        const ox = this.currentBlock.x, oy = this.currentBlock.y, offsets = this.currentBlock.type != 1 ? TEST_OFFSETS_JLSTZ : TEST_OFFSETS_I;
            t = initialRotation + Math.max(0, -r*4);
        for (let i = 0; i < 4; i++) {
            this.currentBlock.x = ox + offsets[t][i][0];
            this.currentBlock.y = oy + offsets[t][i][1];
            if (this.collide(this.currentBlock) == Board.NO_COLLISION)
                return true;
        }
        this.currentBlock.x = ox;
        this.currentBlock.y = oy;
        return false;
    }

    falldown(put) {
        if(!this.currentBlock)
            return;
        while(!this.collide(this.currentBlock))
            ++this.currentBlock.y;

        // revert position
        --this.currentBlock.y;
        if(put) {
            this.putBlock(this.currentBlock);
            this.createNewBlock();
        } else {
            this.emit(Board.EVENT_UPDATE);
        }
    }

    moveUpIfBlocked() {
        if(!this.currentBlock)
            return;
        const bb = this.currentBlock.getBoundingBox(), blockHeight = Math.abs(bb.maxy - bb.miny);
        while(this.collide(this.currentBlock)) {
            if(this.currentBlock.y <= -blockHeight) {
                this.putBlock(this.currentBlock);
                this.createNewBlock();
                break;
            }
            --this.currentBlock.y;
        }
    }

    use(msg) {
        const special = Special.getSpecial(msg.s);
        this.emit(Player.EVENT_SPECIAL, msg);
        const change = special.apply(this, msg);
        this.checklines(false);
        if(change) {
            this.moveUpIfBlocked();
            this.emit(Board.EVENT_CHANGE);
        }
    }
}

Player.TIME_FLIP = 10000;
Player.TIME_INVISIBLE = 10000;
Player.TIME_REFLECT = 10000;
Player.TIME_SPEED = 15000;

Player.INVENTORY_MAX = 18;
Player.DROP_DELAY = 1000;
Player.NEWBLOCK_DELAY = 150;

Player.EVENT_GAMEOVER = "gameover";
Player.EVENT_INVENTORY = "inventory";
Player.EVENT_NEW_BLOCK = "new_block";
Player.EVENT_DROP = "drop";
Player.EVENT_SPECIAL = "special";
Player.EVENT_NOTIFY = "notify";

Player.ROTATION_SYSTEM_CLASSIC = 0;
Player.ROTATION_SYSTEM_SRS = 1;

Player.BLOCK_GENERATOR_RANDOM = 0;
Player.BLOCK_GENERATOR_7BAG = 1;

export default Player