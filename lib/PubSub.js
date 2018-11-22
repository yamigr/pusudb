/** 
 * Autor: yannick grund, 2018
 * This class implements the publish subscribe pattern
*/

const net = require('net');
const EventEmitter = require('events').EventEmitter;
const wildcard = require('node-wildcard');

class PubSub {

    constructor(options){
        this.topics = {}
        this.wildcards = {}
        this.block = true
        this.options = options
    }

    handle(meta, chunk, sock){
    
        switch(meta){
            case 'publish':

                this.consoleLogger(meta, chunk)

                this.publish(chunk.key, chunk.value, sock)
                if(Object.keys(this.wildcards).length){
                    this.wildcardpublish(chunk.key, chunk.value, sock)
                }
            break
            case 'subscribe':

                this.consoleLogger(meta, chunk)

                // Subscribe single or multiple
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

                this.consoleLogger(meta, chunk)

                // Unsubscribe single or muliple
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

            this.consoleLogger(meta, '-')
            
            // Destroy socket when ws closed or key is deleted
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
                        this.topics[topic][socket].send(JSON.stringify({ err : null, data : { key : topic, value: payload}}));		
                    }
                }
                else{
                    this.topics[topic][socket].send(JSON.stringify({ err : null, data : { key : topic, value: payload}}));	
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
                if(wildcard(topic, card)){
                  
                    for(let socket in this.wildcards[card]){
                        try{
                            if(this.block){
                                if(this.wildcards[card][socket] !== sock){
                                    this.wildcards[card][socket].send(JSON.stringify({ err : null, data : { key : topic, value: payload}}));		
                                }
                            }
                            else{
                                this.wildcards[card][socket].send(JSON.stringify({ err : null, data : { key : topic, value: payload}}));		
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
        // replace wildcard for the wildcard-package
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

    /**
    * Convert the db-metas to the pubsub specific names
    * @param {string} meta 
    */
    convertMeta(meta){
        let m = meta
        if(meta === 'put' || meta === 'update'){
            m = 'publish'
        }
        else if(meta === 'del'){
            m = 'unsubscribe'
        }
        return m
    }

    consoleLogger(meta, chunk){
        if(this.options.log){
            console.debug('PUBSUB', Date(), meta, chunk)
        }
    }
}



module.exports = PubSub
