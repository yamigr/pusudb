
const net = require('net');
const EventEmitter = require('events').EventEmitter;
const wildcard = require('wildcard');

class PubSub {

    constructor(){
        this.topics = {}
        this.wildcards = {}
        this.block = true
    }

    handle(meta, chunk, sock){

        switch(meta){
            case 'publish':
                this.publish(chunk.key, chunk.value, sock)
                if(Object.keys(this.wildcards).length){
                    this.wildcardpublish(chunk.key, chunk.value, sock)
                }
            break
            case 'subscribe':
                if(typeof chunk === 'string'){
                    this.subscribe(chunk, sock)  
                }
                else{
                    for(let t in chunk){
                        this.subscribe(chunk[t], sock)         
                    }
                }
            break
            case 'unsubscribe':
                if(typeof chunk === 'string'){
                    this.unsubscribe(chunk, sock)  
                }
                else{
                    for(let t in chunk){
                        this.unsubscribe(chunk[t], sock)         
                    }
                }
            break
            case 'destroy':
            this.destroy(sock)
            break;
            default:
            break
        }
    }

    publish(topic, payload, sock){
        for(let socket in this.topics[topic]){
            try{
                if(this.block){
                    if(this.topics[topic][socket] !== sock){
                        this.topics[topic][socket].send(Buffer.from(JSON.stringify({ key : topic, value: payload})));		
                    }
                }
                else{
                    this.topics[topic][socket].send(Buffer.from(JSON.stringify({ key : topic, value: payload})));	
                }
            }
            catch(e){
                console.error(e)
            }
        }
    }

    wildcardpublish(topic, payload, sock){
        //loop the wildcard topics and check if one match, if so, publish to all sockets
        for(let card in this.wildcards){
            try {
                if(wildcard(card, topic)){
                  
                    for(let socket in this.wildcards[card]){
                        try{
                            if(this.block){
                                if(this.wildcards[card][socket] !== sock){
                                    this.wildcards[card][socket].send(Buffer.from(JSON.stringify({ key : topic, value: payload})));		
                                }
                            }
                            else{
                                this.wildcards[card][socket].send(Buffer.from(JSON.stringify({ key : topic, value: payload})));		
                            }
                        }
                        catch(e){
                            console.error(e)
                        }
                    }
                }
            }
            catch(e){
                console.error(e)
            }
        }
    }

    subscribe(topic, sock){
        if(topic.indexOf('#') === -1){
            if(!this.topics[topic]){
                this.topics[topic] = []
            }
            this.topics[topic].push(sock)
        }
        else{
            this.wildcardsubscribe(topic, sock)
        }
    }

    wildcardsubscribe(topic, sock){
        let card =  topic.replace(/#/g, '*')//topic.slice(0, -1) + '*'
        if(!this.wildcards[card]){
            this.wildcards[card] = []
        }
        this.wildcards[card].push(sock)
    }

    unsubscribe(topic, sock){
        if(topic.indexOf('#') === -1){
            if(this.topics[topic]){
                try {
                    delete this.topics[topic][this.topics[topic].indexOf(sock)]
                }
                catch(e){
                    console.error(e)
                }
            }
        }
        else{
            this.wildcardunsubscribe(topic, sock)
        }
    }

    wildcardunsubscribe(topic, sock){
        let card =  topic.replace(/#/g, '*')//topic.slice(0, -1) + '*'
        if(this.wildcards[card]){
            try {
                delete this.wildcards[card][this.wildcards[card].indexOf(sock)]
            }
            catch(e){
                console.error(e)
            }
        }
    }

    destroy(sock){
        for(let topic in this.topics){
            try{
                delete this.topics[topic][ this.topics[topic].indexOf(sock) ]
            }
            catch(e){
                console.error(e)
            }   
        }
        this.wildcarddestroy(sock)
    }


    wildcarddestroy(sock){
        for(let topic in this.wildcards){
            try{
                delete this.wildcards[topic][ this.wildcards[topic].indexOf(sock) ]
            }
            catch(e){
                console.error(e)
            }   
        } 
    }
}



module.exports = PubSub
