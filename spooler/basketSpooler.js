

function __addToClientPool(pool,basket,client,data){

	//create collaborators if not given
	if(pool[basket]['collaborators']==undefined){pool[basket]['collaborators']={};}

	pool[basket]['collaborators'][client]=data;
	console.log(basket+' :: '+client+'  --> client added to pool');
	return this;
}

function __createBasketPool(pool,basket_id){
	pool[basket_id]={};

	console.log(basket_id+' :: 00 <-> CREATED A BASKET POOL');

	return true;
}

function __viewBasketPool(pool,client){
	return pool[client];
}


module.exports={
	create:__createBasketPool,
	add:__addToClientPool,
	view:__viewBasketPool
}
