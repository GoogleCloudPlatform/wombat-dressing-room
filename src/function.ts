import {app} from './server-app'
import { Request, Response } from 'express';

module.exports.server = (req:Request,res:Response)=>{
  app(req,res);
}