
function __removeFromClientPool(pool,client){
	delete pool[client];
	console.log(client+' :: --> client removed from pool');
	return this;
}


function __addToClientPool(pool,client,data){
	pool[client]=data;
	console.log(client+' :: --> client added to pool');
	return this;
}


function __viewClient(pool,client){
	return pool[client];
}


module.exports={
	add:__addToClientPool,
	remove:__removeFromClientPool,
	view:__viewClient
}
