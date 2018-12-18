/** 
 * Autor: yannick grund, 2018
 * This class implements the publish subscribe pattern
*/

const wildcard = require('node-wildcard');
const helpers = require('./helpers')

class PubSub {

    constructor(options){
        this.topics = {}
        this.wildcards = {}
        this.block = true
        this.options = options
    }

    /**
     * 
     * @param {string} noExtDb noExtDb-name without extension
     * @param {string} meta 
     * @param {object} chunk 
     * @param {object} sock 
     */
    handle(noExtDb, meta, chunk, sock){

        switch(meta){
            case 'del':
                // publish delete and delete all sockets
                this.consoleLogger(noExtDb, meta, chunk)
                this.publish(noExtDb, meta, chunk.key, sock)
                if(Object.keys(this.wildcards).length){
                    this.wildcardpublish(noExtDb, meta, chunk.key, sock)
                }
                this.unsubscribeAll(noExtDb + chunk.key, sock)  
            break
            case 'put':
            case 'batch':
            case 'update':
            case 'publish':
                this.consoleLogger(noExtDb, meta, chunk)
                this.publish(noExtDb, meta, chunk, sock)
                if(Object.keys(this.wildcards).length){
                    this.wildcardpublish(noExtDb, meta, chunk, sock)
                }
            break
            case 'subscribe':
                this.consoleLogger(noExtDb, meta, chunk)
                // Subscribe single or multiple
                if(typeof chunk === 'string'){
                    this.subscribe(noExtDb + chunk, sock)  
                }
                else{
                    for(let t in chunk){
                        this.subscribe(noExtDb + chunk[t], sock)         
                    }
                }
            break
            case 'unsubscribe':
                this.consoleLogger(noExtDb, meta, chunk)
                // Unsubscribe single or muliple
                if(typeof chunk === 'string'){
                    this.unsubscribe(noExtDb + chunk, sock)  
                }
                else{
                    for(let t in chunk){
                        this.unsubscribe(noExtDb + chunk[t], sock)         
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

    publish(noExtDb, meta, chunk, sock){
        let topic = typeof chunk === 'string' ? chunk : chunk.key
        let concatedTopic = noExtDb + topic
        for(let socket in this.topics[concatedTopic]){
            try{
                if(this.block){
                    if(this.topics[concatedTopic][socket] !== sock){
                        if(!this.send(this.topics[concatedTopic][socket], { err : null, db : noExtDb, meta : meta, data : chunk})){
                            this.unsubscribe(concatedTopic, this.topics[concatedTopic][socket])
                        }
                    }
                }
                else{
                    if(!this.send(this.topics[concatedTopic][socket], { err : null, db : noExtDb, meta : meta, data : chunk})){
                        this.unsubscribe(concatedTopic, this.topics[concatedTopic][socket])
                    }
                }
            }
            catch(e){
                console.error(e)
            }
        }
    }

    wildcardpublish(noExtDb, meta, chunk, sock){
        let topic = typeof chunk === 'string' ? chunk : chunk.key
        let concatedTopic = noExtDb + topic
        //loop the wildcard topics and check if one match, if so, publish to all sockets
        for(let card in this.wildcards){
            try {
                if(wildcard(concatedTopic, card)){
                  
                    for(let socket in this.wildcards[card]){
                        try{
                            if(this.block){
                                if(this.wildcards[card][socket] !== sock){
                                    if(!this.send(this.wildcards[card][socket], { err : null, db : noExtDb, meta : meta, data : chunk})){
                                        this.unsubscribe(concatedTopic, this.wildcards[card][socket])
                                    }	
                                }
                            }
                            else{
                                if(!this.send(this.wildcards[card][socket], { err : null, db : noExtDb, meta : meta, data : chunk})){
                                    this.unsubscribe(concatedTopic, this.wildcards[card][socket])
                                }			
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
            if(this.topics[topic].indexOf(sock) === -1){
                this.topics[topic].push(sock)
            }
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
        if(this.wildcards[card].indexOf(sock) === -1){
            this.wildcards[card].push(sock)
        }
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

    unsubscribeAll(topic){
        if(this.topics[topic]){
            try {
                delete this.topics[topic]
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

    convertBatch(data){
        let k = []
        let d = []

        for(let el in data){
            if(data[el].type === 'put'){
                k.push(data[el].key)
                d.push({ key : data[el].key, value : data[el].value } )
            }
        }

        if(k.length){
            k = helpers.commonSubstring(k)
            return { key : k, value : d }
        }
        else{
            return data
        }

    }

    send(ws, data){
        try{
            ws.send(JSON.stringify(data));
            return true	
        }
        catch(e){
            return false
        }
    }

    consoleLogger(){
        if(this.options.log){
            console.debug('PUBSUB', Date(), arguments[0], arguments[1])
        }
    }
}



module.exports = PubSub
