'use strict';

const http=require('http');
const express=require('express');


//other config
const basketSpooler=require('./spooler/basketSpooler');
const clientSpooler=require('./spooler/clientSpooler');
const PORT = 65080;

//bind websocket to http server (this is required)
var app=express();
var httpServer=http.Server(app);
var io=require('socket.io')(httpServer);


/*------------------------------------------------
| Allow CORS
| https://github.com/socketio/socket.io-client/issues/641
|-------------------------------------------------*/
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
    next();
});





var clients={};
var client_count=0; 
var socket_details={}


var baskets={}


io.on('connection', function(socket){

  	console.log('----------------------------------------');
	console.log('\u{26AB} CONNECTED')
	console.log('----------------------------------------');



  	socket.on('disconnect',function(){
		console.log('\u{26AB} Client disconnected')
		// remove socket details
		// TEMPORARY store client
		//clientSpooler.remove(clients,socket_details[socket.id]);
		

	})






  	/*-------------------------
  	| Handshake:2 receiver
  	|-------------------------*/
	socket.on('handshake',(data)=>{

		var user_data=(JSON.parse(data.data))
		var socket_id=socket.id;

		//stop execution if no body is receive
		if(user_data==null) return 0;

		//save socket id to user pool
		user_data.socket={}
		user_data.socket.id=socket_id;

		user_data.notifications=[];

		/*-----------------------------------------
		| CUSTOM SOCKET TOKEN
		| Generate unique socket id for socket authentication
		| EXTRA security- this must match to the
		|------------------------------------------*/
		var __cookie=socket.handshake.headers.cookie;
		var __ip=socket.handshake.address;
		var __date= new Date().getTime();
		var __socket_token=__date+'000'+Math.random()+''+__cookie;
		
		//save socket token
		user_data.socket.token=__socket_token;

		//prevent unauthenticated users
		if(!user_data.details) return 0


		/*------------------------
		| USER POOL
		| Add to pool if haven't connected on the very first time
		|-------------------------*/

		var __socket_old_details=(clientSpooler.view(clients,user_data.details.uid))

		if(typeof __socket_old_details=='undefined'){
			//add to user pool
			clientSpooler.add(clients,user_data.details.uid,user_data);
		}else{

			//get old notification and assign to new socket
			user_data.notifications=__socket_old_details.notifications;

			//add to user pool
			clientSpooler.add(clients,user_data.details.uid,user_data);

			console.log(user_data.details.uid+'::00  -> RECONNECTED')
			
		}

		//store uid to socket details
		//to be used for removing clients from the pool
		socket_details[socket_id]=user_data.details.uid;


		/*-------------------------
	  	| Handshake :3 emmiter
	  	|-------------------------*/
		socket.emit('handshake',{message:'hello',data:__socket_token});


	});






	/*-------------------------
  	| Handshake :1 emmiter
  	|-------------------------*/
	socket.emit('handshake',{message:'hi'});




	/*-------------------------
  	| BASKET CONNECTION
  	| Add basket to spooler
  	|-------------------------*/
	socket.on('basket',(data)=>{
		
		var __collaborators=data.collaborators;
		var __basket_id=data.basket_id;

		var __socket_uid=socket_details[socket.id]; //get user id

		//get user credentials including token
		var __socket_uid_details=clientSpooler.view(clients,__socket_uid);



		/*-------------------------
	  	| NEW BASKET
	  	|-------------------------
	  	| NOTES: NEWLY INCLUDED COLLOBARATOR COULD NOT RECEIVED NOTIF
	  	| THIS IS A BUG TO BE RESOLVED
	  	|--------------------------*/
		if(typeof baskets[__basket_id]=='undefined'){

			if(basketSpooler.create(baskets,__basket_id)){

				//create basket notifications
				baskets[__basket_id].notifications=[];

				//add __self to basket
				basketSpooler.add(baskets,__basket_id,__socket_uid,{timestamp:new Date()});

				//add other user to pool
				for(var x in __collaborators){
					//add empty credentials
					basketSpooler.add(baskets,__basket_id,x,{timestamp:new Date()});
					
				}
			}
		}else{

			/*----------------------------
			| OLD Basket
			| Update user's last access
			|---------------------------*/
			var __basket=(basketSpooler.view(baskets,__basket_id));


			try{
				__basket.collaborators[__socket_uid]['timestamp']=new Date();
			}catch(e){
				console.log('------------------------------------------------------');
				console.log(__basket_id+ ':\t ERROR -> could not modify user timestamp \r\n \t [User do not belong to this basket]')
				console.log('------------------------------------------------------');
			}

		}

	})




	/*-------------------------
  	| NOTIFICATION CONNECTION
  	| Add basket to spooler
  	|-------------------------*/
	socket.on('notifications',(data)=>{
		var __socket_uid=socket_details[socket.id]; //get user id

		//get user credentials including token
		var __socket_uid_details=clientSpooler.view(clients,__socket_uid);

		

		io.sockets.connected[socket.id].emit('notifications',{notifications:__socket_uid_details.notifications});

	});


	socket.on('upload',(data)=>{

		var __socket_uid=socket_details[socket.id]; //get user id

		//get user credentials including token
		var __socket_uid_details=clientSpooler.view(clients,__socket_uid);

		//generate name
		__socket_uid_details.details.name=__socket_uid_details.details.first_name+' '+__socket_uid_details.details.last_name;


		if(data.message=='create'){
			var message={
				status:200,
				notifications:[
					{"id":data.file_id,
					"receiver_id":"mask",
					"sender_uid":__socket_uid,
					"basket_id":data.basket_id,
					"action":"uploaded",
					"date_created":'',
					"flag":"unread",
					"name":data.details.basket_name,
					"sender":__socket_uid_details.details,
					"message":"Added an attachment to \<b\>"+data.details.basket_name+"\</\b\>"}
				]
			};



			var __basket_details=basketSpooler.view(baskets,data.basket_id);

			

			var collaborators=basketSpooler.view(baskets,data.basket_id)['collaborators'];


			//push notification to basket that is accessible to all collaborators
			__basket_details.notifications.push(message);


			for(let x in collaborators){
				if(x!=socket_details[socket.id]){


					//create empty stack for clients that are not yet connected 
					if(typeof clients[x]=='undefined'){
						clients[x]={}
						clients[x].notifications=[];
					}else{


						//push to client stack
						clients[x].notifications.push(message)



						/*----------------------------------------
						| PUSH notification for connected clients
						|----------------------------------------*/
						if(typeof clients[x].socket!='undefined'){
							//notify client
							try{
								io.sockets.connected[clients[x].socket.id].emit('notifications',message);	
							}catch(e){}
						}



					}


				}
			}

		}
		
		
	});


});





httpServer.listen(PORT,function(){
	console.log('----------------------------------------');
	console.log('\u{26AB} listening on port : '+PORT)
	console.log('----------------------------------------');
});

